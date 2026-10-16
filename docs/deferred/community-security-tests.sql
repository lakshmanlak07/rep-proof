-- ── 9. RPE and bar speed on sets, crash reports (migration 6) ──
do $$
declare w uuid; n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  w := public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'Upper A', null, now(), 0, 1,
    '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"rpe":8,"velocity":0.45},{"exercise_id":"bb_bench","set_index":1,"weight":60,"reps":8,"rir":1}]');
  select count(*) into n from public.logged_sets where workout_id = w and rpe = 8 and velocity = 0.45; perform pg_temp.ok(n = 1, 'RPE and bar speed save with the set');
  select count(*) into n from public.logged_sets where workout_id = w and rpe is null and velocity is null; perform pg_temp.ok(n = 1, 'RPE and bar speed stay optional');
  begin
    perform public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"rpe":8.3}]');
    perform pg_temp.ok(false, 'RPE outside half steps refused');
  exception when check_violation then perform pg_temp.ok(true, 'RPE outside half steps refused'); end;
  begin
    perform public.save_workout(gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-0000000000a1', 0, 'x', null, now(), 0, 1,
      '[{"exercise_id":"bb_bench","set_index":0,"weight":60,"reps":8,"rir":2,"velocity":9}]');
    perform pg_temp.ok(false, 'impossible bar speed refused');
  exception when check_violation then perform pg_temp.ok(true, 'impossible bar speed refused'); end;

  insert into public.client_errors (message, stack, context) values ('TypeError: x is undefined', 'at Workout', '{"route":"/workout"}');
  perform pg_temp.ok(true, 'crash report can be sent');
  begin select count(*) into n from public.client_errors; perform pg_temp.ok(false, 'crash reports are write-only');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'crash reports are write-only'); end;
  begin insert into public.client_errors (user_id, message) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'forged');
    perform pg_temp.ok(false, 'crash report cannot be filed as someone else');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'crash report cannot be filed as someone else'); end;
  begin insert into public.client_errors (message) values (repeat('m', 600)); perform pg_temp.ok(false, 'oversized crash report refused');
  exception when check_violation then perform pg_temp.ok(true, 'oversized crash report refused'); end;
end $$;
reset role;

-- ── 10. Community: opt-in, privacy, blocking, content rules, reports, moderation, limits ──
insert into auth.users (id, email, aud, role) values
  ('cccccccc-0000-4000-8000-0000000000c1', 'sec-test-c@example.invalid', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-0000000000d1', 'sec-test-m@example.invalid', 'authenticated', 'authenticated');
insert into public.community_profiles (user_id, handle, display_name) values
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'bee', 'B'),
  ('dddddddd-0000-4000-8000-0000000000d1', 'mod_m', 'M');
insert into public.moderators (user_id) values ('dddddddd-0000-4000-8000-0000000000d1');
insert into public.posts (id, user_id, body) values
  ('bbbbbbbb-0000-4000-8000-0000000000b3', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Leg day: squats felt strong today'),
  ('bbbbbbbb-0000-4000-8000-0000000000b4', 'bbbbbbbb-0000-4000-8000-00000000000b', 'Second post');

do $$
declare n int;
begin
  perform pg_temp.as_anon();
  begin select count(*) into n from public.posts; perform pg_temp.ok(false, 'anonymous cannot read the community');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anonymous cannot read the community'); end;
end $$;
reset role;

do $$
declare n int; st text; r text;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  select count(*) into n from public.posts where status = 'visible'; perform pg_temp.ok(n = 2, 'signed-in members can read visible posts');
  begin insert into public.posts (body) values ('hello'); perform pg_temp.ok(false, 'no posting without opting in to a community profile');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'no posting without opting in to a community profile'); end;

  insert into public.community_profiles (handle, display_name) values ('alpha', 'A');
  select show_stats::text into st from public.community_profiles where user_id = auth.uid(); perform pg_temp.ok(st = 'false', 'training stats are private by default');
  begin update public.community_profiles set banned_until = null where user_id = auth.uid(); perform pg_temp.ok(false, 'members cannot lift their own ban');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot lift their own ban'); end;
  begin insert into public.community_profiles (handle, display_name) values ('Bad Handle!', 'x'); perform pg_temp.ok(false, 'invalid handle refused');
  exception when check_violation then perform pg_temp.ok(true, 'invalid handle refused'); end;

  insert into public.posts (body, topic) values ('Hit a rep PR on bench today', 'progress');
  select status into st from public.posts where body = 'Hit a rep PR on bench today'; perform pg_temp.ok(st = 'visible', 'normal post is visible');
  begin insert into public.posts (user_id, body) values ('bbbbbbbb-0000-4000-8000-00000000000b', 'forged'); perform pg_temp.ok(false, 'cannot post as someone else');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'cannot post as someone else'); end;
  begin insert into public.posts (body, status) values ('sneaky', 'visible'); perform pg_temp.ok(false, 'members cannot set post status');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot set post status'); end;

  insert into public.posts (body) values ('Run 500 mg of test e for 12 weeks');
  select status, held_reason into st, r from public.posts where body like 'Run 500 mg%'; perform pg_temp.ok(st = 'held', 'steroid and dosing post is held for review');
  insert into public.posts (body) values ('Take 5g creatine and 400 mg caffeine before training');
  select status into st from public.posts where body like 'Take 5g creatine%'; perform pg_temp.ok(st = 'held', 'supplement dosing post is held for review');
  insert into public.posts (body) values ('Check my store at www.example.com');
  select status into st from public.posts where body like 'Check my store%'; perform pg_temp.ok(st = 'held', 'post with a link is held for review');
  update public.posts set body = 'cleaned up' where body like 'Run 500 mg%';
  select status into st from public.posts where body = 'cleaned up'; perform pg_temp.ok(st = 'held', 'editing cannot release a held post');
  begin update public.posts set status = 'visible' where body = 'cleaned up'; perform pg_temp.ok(false, 'author cannot release a held post');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'author cannot release a held post'); end;

  insert into public.post_likes (post_id) values ('bbbbbbbb-0000-4000-8000-0000000000b3');
  select like_count into n from public.posts where id = 'bbbbbbbb-0000-4000-8000-0000000000b3'; perform pg_temp.ok(n = 1, 'like counted by the server');
  begin insert into public.post_likes (post_id) values ('bbbbbbbb-0000-4000-8000-0000000000b3'); perform pg_temp.ok(false, 'cannot like twice');
  exception when unique_violation then perform pg_temp.ok(true, 'cannot like twice'); end;
  begin update public.posts set like_count = 999 where id = 'bbbbbbbb-0000-4000-8000-0000000000b3'; perform pg_temp.ok(false, 'members cannot write like counts');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot write like counts'); end;
  insert into public.comments (post_id, body) values ('bbbbbbbb-0000-4000-8000-0000000000b3', 'Nice work');
  select comment_count into n from public.posts where id = 'bbbbbbbb-0000-4000-8000-0000000000b3'; perform pg_temp.ok(n = 1, 'comment counted by the server');
  update public.posts set body = 'hijacked' where id = 'bbbbbbbb-0000-4000-8000-0000000000b3'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'cannot edit another member''s post');
  delete from public.posts where id = 'bbbbbbbb-0000-4000-8000-0000000000b3'; get diagnostics n = row_count; perform pg_temp.ok(n = 0, 'cannot delete another member''s post');
  insert into public.follows (followee_id) values ('bbbbbbbb-0000-4000-8000-00000000000b');
  insert into public.reports (post_id, reason) values ('bbbbbbbb-0000-4000-8000-0000000000b4', 'spam');
  begin insert into public.reports (post_id, reason) values ('bbbbbbbb-0000-4000-8000-0000000000b4', 'spam'); perform pg_temp.ok(false, 'one report per member per post');
  exception when unique_violation then perform pg_temp.ok(true, 'one report per member per post'); end;
  begin insert into public.reports (post_id, reason) values ('bbbbbbbb-0000-4000-8000-0000000000b3', 'boring'); perform pg_temp.ok(false, 'unknown report reason refused');
  exception when check_violation then perform pg_temp.ok(true, 'unknown report reason refused'); end;
  begin perform public.moderate('post', 'bbbbbbbb-0000-4000-8000-0000000000b3', 'removed'); perform pg_temp.ok(false, 'members cannot moderate');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot moderate'); end;
  begin perform public.ban_member('bbbbbbbb-0000-4000-8000-00000000000b', 30); perform pg_temp.ok(false, 'members cannot ban');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot ban'); end;
  begin insert into public.moderators (user_id) values (auth.uid()); perform pg_temp.ok(false, 'members cannot make themselves moderators');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'members cannot make themselves moderators'); end;
  select count(*) into n from public.moderation_actions; perform pg_temp.ok(n = 0, 'members cannot read the moderation log');
end $$;
reset role;

do $$
declare n int;
begin
  perform pg_temp.as_user('bbbbbbbb-0000-4000-8000-00000000000b');
  select count(*) into n from public.posts where status = 'held'; perform pg_temp.ok(n = 0, 'held posts are hidden from other members');
  select count(*) into n from public.post_likes; perform pg_temp.ok(n = 0, 'who liked a post is private');
  select count(*) into n from public.follows where follower_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 1, 'members see who follows them');
  select count(*) into n from public.reports; perform pg_temp.ok(n = 0, 'members cannot see reports about their posts');
  select count(*) into n from public.community_stats('aaaaaaaa-0000-4000-8000-00000000000a') where workouts_30d > 0; perform pg_temp.ok(n = 0, 'training stats hidden unless shared');
  insert into public.blocks (blocked_id) values ('aaaaaaaa-0000-4000-8000-00000000000a');
  select count(*) into n from public.posts where user_id = 'aaaaaaaa-0000-4000-8000-00000000000a'; perform pg_temp.ok(n = 0, 'blocking hides the blocked member''s posts');
end $$;
reset role;

do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  select count(*) into n from public.posts where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'blocked member cannot see the blocker''s posts');
  select count(*) into n from public.community_profiles where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b'; perform pg_temp.ok(n = 0, 'blocked member cannot see the blocker''s profile');
  select count(*) into n from public.follows; perform pg_temp.ok(n = 0, 'blocking ends the follow');
  select count(*) into n from public.blocks; perform pg_temp.ok(n = 0, 'blocked member cannot see who blocked them');
  begin insert into public.comments (post_id, body) values ('bbbbbbbb-0000-4000-8000-0000000000b4', 'hey'); perform pg_temp.ok(false, 'blocked member cannot comment');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'blocked member cannot comment'); end;
  begin insert into public.follows (followee_id) values ('bbbbbbbb-0000-4000-8000-00000000000b'); perform pg_temp.ok(false, 'blocked member cannot follow again');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'blocked member cannot follow again'); end;
end $$;
reset role;

-- Three members reporting one post holds it; then a moderator reviews it.
do $$
begin
  perform pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c1');
  insert into public.reports (post_id, reason) values ('bbbbbbbb-0000-4000-8000-0000000000b4', 'harassment');
end $$;
reset role;
do $$
begin
  perform pg_temp.as_user('dddddddd-0000-4000-8000-0000000000d1');
  insert into public.reports (post_id, reason, details) values ('bbbbbbbb-0000-4000-8000-0000000000b4', 'unsafe_training', 'tells beginners to max out daily');
end $$;
reset role;
do $$
declare n int; st text;
begin
  select status into st from public.posts where id = 'bbbbbbbb-0000-4000-8000-0000000000b4'; perform pg_temp.ok(st = 'held', 'three reports hold a post for review');
  perform pg_temp.as_user('dddddddd-0000-4000-8000-0000000000d1');
  perform pg_temp.ok(public.is_moderator(), 'moderator is recognised');
  select count(*) into n from public.reports where status = 'open'; perform pg_temp.ok(n = 3, 'moderator sees the report queue');
  select count(*) into n from public.posts where status = 'held'; perform pg_temp.ok(n >= 4, 'moderator sees held posts');
  perform public.moderate('post', 'bbbbbbbb-0000-4000-8000-0000000000b4', 'visible', 'reviewed: fine');
  select status into st from public.posts where id = 'bbbbbbbb-0000-4000-8000-0000000000b4'; perform pg_temp.ok(st = 'visible', 'moderator can restore a post');
  select count(*) into n from public.reports where post_id = 'bbbbbbbb-0000-4000-8000-0000000000b4' and status = 'dismissed'; perform pg_temp.ok(n = 3, 'restoring dismisses its reports');
  perform public.moderate('post', (select id from public.posts where body = 'Check my store at www.example.com'), 'removed', 'spam link');
  select count(*) into n from public.moderation_actions; perform pg_temp.ok(n = 2, 'every moderation action is logged');
  perform public.ban_member('aaaaaaaa-0000-4000-8000-00000000000a', 7, false, 'test ban');
end $$;
reset role;
do $$
declare n int;
begin
  perform pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
  begin insert into public.posts (body) values ('still here'); perform pg_temp.ok(false, 'banned member cannot post');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'banned member cannot post'); end;
  select count(*) into n from public.posts where body = 'Check my store at www.example.com' and status = 'removed'; perform pg_temp.ok(n = 1, 'author still sees their removed post with its status');
end $$;
reset role;

-- Post rate limit: 10 a day.
do $$
declare i int;
begin
  perform pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c1');
  insert into public.community_profiles (handle, display_name) values ('charlie', 'C');
  for i in 1..10 loop insert into public.posts (body) values ('post ' || i); end loop;
  begin insert into public.posts (body) values ('post 11'); perform pg_temp.ok(false, '11th post in a day is refused');
  exception when raise_exception then perform pg_temp.ok(true, '11th post in a day is refused'); end;
end $$;
reset role;
update public.community_profiles set show_stats = true where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
do $$
declare n int;
begin
  perform pg_temp.as_user('cccccccc-0000-4000-8000-0000000000c1');
  select workouts_30d into n from public.community_stats('bbbbbbbb-0000-4000-8000-00000000000b'); perform pg_temp.ok(n = 1, 'shared training stats are visible to others');
  delete from public.community_profiles where user_id = auth.uid();
  select count(*) into n from public.posts where body like 'post %'; perform pg_temp.ok(n = 0, 'leaving the community deletes the member''s posts');
end $$;
reset role;

