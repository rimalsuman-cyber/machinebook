-- Company data stays in Supabase, never in this repository.
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160));
create table public.memberships (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin','viewer')),
  primary key(org_id,user_id)
);
create table public.items (
  id uuid primary key,
  org_id uuid not null references public.organizations on delete cascade,
  kind text not null check(kind in ('category','machine','step','note','issue','asset')),
  parent_id uuid references public.items on delete cascade,
  category_id uuid references public.items on delete restrict,
  data jsonb not null default '{}',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(data) = 'object' and octet_length(data::text) < 1000000)
);
create index items_org on public.items(org_id);
create index items_parent on public.items(parent_id);
create index items_category on public.items(category_id);
create index memberships_user on public.memberships(user_id);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.items enable row level security;

create function public.is_member(p_org uuid, p_write boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where org_id=p_org and user_id=auth.uid() and (not p_write or role='admin'));
$$;
revoke all on function public.is_member(uuid,boolean) from public;
grant execute on function public.is_member(uuid,boolean) to authenticated;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
create policy company_read on public.organizations for select to authenticated using(public.is_member(id));
create policy item_read on public.items for select to authenticated using(public.is_member(org_id));
-- No direct client writes: mutation functions enforce role, ownership, references and optimistic concurrency.
revoke all on public.organizations,public.memberships,public.items from anon,authenticated;
grant select on public.organizations,public.memberships,public.items to authenticated;

create function public.my_workspaces() returns table(org_id uuid,user_id uuid,role text,name text)
language sql stable security invoker set search_path = '' as $$
 select m.org_id,m.user_id,m.role,o.name from public.memberships m join public.organizations o on o.id=m.org_id where m.user_id=auth.uid();
$$;
revoke all on function public.my_workspaces() from public;
grant execute on function public.my_workspaces() to authenticated;

create function public.save_item(p_item jsonb,p_expected integer) returns public.items
language plpgsql security definer set search_path = '' as $$
declare
  v public.items; old public.items; related public.items; result public.items; ancestor uuid;
begin
  v.id := (p_item->>'id')::uuid; v.org_id := (p_item->>'org_id')::uuid;
  v.kind := p_item->>'kind'; v.parent_id := (p_item->>'parent_id')::uuid;
  v.category_id := (p_item->>'category_id')::uuid; v.data := p_item->'data';
  if not public.is_member(v.org_id,true) then raise exception 'FORBIDDEN'; end if;
  -- Serialize structural changes in one company, including category moves and deletions.
  perform pg_advisory_xact_lock(hashtextextended(v.org_id::text,0));
  select * into old from public.items where id=v.id for update;
  if found then
    if old.org_id<>v.org_id or old.kind<>v.kind then raise exception 'FORBIDDEN'; end if;
    if old.revision<>p_expected then raise exception 'CONFLICT: record changed'; end if;
  elsif p_expected<>0 then raise exception 'CONFLICT: record deleted'; end if;
  if v.kind<>'asset' and length(trim(coalesce(v.data->>case when v.kind in ('machine','category') then 'name' else 'title' end,'')))=0 then raise exception 'Title or name required'; end if;
  if v.parent_id is not null then
    select * into related from public.items where id=v.parent_id and org_id=v.org_id;
    if not found then raise exception 'Parent unavailable'; end if;
    if not ((v.kind='category' and related.kind='category') or (v.kind in ('step','note','issue') and related.kind='machine') or (v.kind='asset' and related.kind in ('machine','step','note','issue','category'))) then raise exception 'Invalid parent'; end if;
    ancestor := v.parent_id;
    while ancestor is not null loop
      if ancestor=v.id then raise exception 'Category cycle'; end if;
      select parent_id into ancestor from public.items where id=ancestor;
    end loop;
  elsif v.kind in ('step','note','issue','asset') then raise exception 'Parent required'; end if;
  if v.kind='machine' then
    if v.parent_id is not null then raise exception 'Machine cannot have parent'; end if;
    if not exists(select 1 from public.items where id=v.category_id and kind='category' and org_id=v.org_id) then raise exception 'Category required'; end if;
  elsif v.category_id is not null then raise exception 'Invalid category reference'; end if;
  if v.kind='asset' then
    if v.data->>'path' is distinct from v.org_id::text||'/'||v.id::text then raise exception 'Invalid file path'; end if;
    if old.id is not null and (old.data->>'path' is distinct from v.data->>'path' or old.data->>'mime' is distinct from v.data->>'mime') then raise exception 'File identity is immutable'; end if;
  end if;
  insert into public.items(id,org_id,kind,parent_id,category_id,data,revision)
  values(v.id,v.org_id,v.kind,v.parent_id,v.category_id,v.data,1)
  on conflict(id) do update set parent_id=excluded.parent_id,category_id=excluded.category_id,data=excluded.data,revision=public.items.revision+1,updated_at=now()
  where public.items.org_id=v.org_id and public.items.kind=v.kind and public.items.revision=p_expected
  returning * into result;
  if result.id is null then raise exception 'CONFLICT: record changed'; end if;
  return result;
end;
$$;
revoke all on function public.save_item(jsonb,integer) from public;
grant execute on function public.save_item(jsonb,integer) to authenticated;

create function public.delete_item(p_id uuid,p_expected integer) returns text[]
language plpgsql security definer set search_path = '' as $$
declare v public.items; paths text[];
begin
  select * into v from public.items where id=p_id;
  if not found then return array[]::text[]; end if;
  if not public.is_member(v.org_id,true) then raise exception 'FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v.org_id::text,0));
  select * into v from public.items where id=p_id for update;
  if not found then return array[]::text[]; end if;
  if v.revision<>p_expected then raise exception 'CONFLICT: record changed'; end if;
  if v.kind='category' and exists(select 1 from public.items where (parent_id=p_id and kind='category') or category_id=p_id) then raise exception 'Category is in use'; end if;
  with recursive subtree as (select * from public.items where id=p_id union all select i.* from public.items i join subtree s on i.parent_id=s.id)
  select coalesce(array_agg(data->>'path') filter(where kind='asset'),array[]::text[]) into paths from subtree;
  delete from public.items where id=p_id;
  return paths;
end;
$$;
revoke all on function public.delete_item(uuid,integer) from public;
grant execute on function public.delete_item(uuid,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('machinebook','machinebook',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','text/csv','application/dxf','image/vnd.dxf','application/octet-stream']);
-- Avoid casting user-controlled folder names to UUID in policies.
create function public.can_access_file(p_name text,p_write boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where user_id=auth.uid() and org_id::text=split_part(p_name,'/',1) and (not p_write or role='admin'));
$$;
revoke all on function public.can_access_file(text,boolean) from public;
grant execute on function public.can_access_file(text,boolean) to authenticated;
create policy file_read on storage.objects for select to authenticated using(bucket_id='machinebook' and public.can_access_file(name));
create policy file_insert on storage.objects for insert to authenticated with check(bucket_id='machinebook' and public.can_access_file(name,true));
create policy file_update on storage.objects for update to authenticated using(bucket_id='machinebook' and public.can_access_file(name,true)) with check(bucket_id='machinebook' and public.can_access_file(name,true));
create policy file_delete on storage.objects for delete to authenticated using(bucket_id='machinebook' and public.can_access_file(name,true));
