import test from 'node:test';
import assert from 'node:assert/strict';
import {newYorkTimeToISO} from '../calendar-time.mjs';
import {validateCalendar} from '../supabase/functions/coach-proxy-dev/calendar.mjs';

test('Eastern form times work in summer and winter independent of browser timezone',()=>{
 assert.equal(newYorkTimeToISO('2026-09-29T12:00'),'2026-09-29T16:00:00.000Z');
 assert.equal(newYorkTimeToISO('2026-12-15T12:00'),'2026-12-15T17:00:00.000Z');
});
test('DST gaps, repeated times, and impossible dates need correction',()=>{
 for(const time of ['2026-03-08T02:30','2026-11-01T01:30','2026-02-30T12:00',''])assert.throws(()=>newYorkTimeToISO(time));
});
const event={calendar_account:'personal_icloud_family',title:'Test',start_at:'2026-09-29T12:00:00-04:00',end_at:'2026-09-29T12:15:00-04:00',timezone:'America/New_York',location:'',notes:'',all_day:false};
test('calendar proposals cannot promise unsupported fields or ambiguous times',()=>{
 assert.deepEqual(validateCalendar(event),event);
 for(const changes of [{all_day:true},{notes:'Must not be silently omitted'},{start_at:'2026-09-29T12:00'},{end_at:'2026-09-29T11:00:00-04:00'},{calendar_account:'work'}])assert.throws(()=>validateCalendar({...event,...changes}));
});
