"""Compare WorkOS drafts with Python calendar data, independently of the TypeScript validator."""
import calendar
import json
import subprocess
from datetime import date, timedelta
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    cases = []
    for year in range(2023, 2031):
        for month in range(1, 13):
            for start_day in [1, 15, calendar.monthrange(year, month)[1]]:
                first = date(year, month, start_day)
                for length in [1, 2, 7, 28, 60, 90, 92]:
                    cases.append((first, first + timedelta(days=length-1)))

    # Pass fixture dates, then ask the actual planner only for observable schedule fields.
    program = """
import fs from 'node:fs';
import {draftSteps} from './lib/workos/draft.ts';
const dates=JSON.parse(fs.readFileSync(0,'utf8'));
const q={title:'Review a synthetic queue',owner:'Fixture owner',metric:'Duration',unit:'hours',baseline:18,target:10,source:'Fixture measurements'};
let seq=0;
const result=dates.map(([first,due])=>{
  const p=draftSteps({...q,due},()=> 'node-'+(++seq),first);
  const weeks=new Map(p.weeks.map(w=>[w.id,w])),months=new Map(p.months.map(m=>[m.id,m]));
  return [p.tasks.map(t=>t.due),p.months.map(m=>m.due),
    p.tasks.every((t,i)=>{const w=weeks.get(t.parent),m=months.get(w.parent);
      return t.due<=w.due&&w.due<=m.due&&m.parent==='quarter'&&t.due.slice(0,7)===m.due.slice(0,7)&&t.after===(i?p.tasks[0].id:null);})];
});
process.stdout.write(JSON.stringify(result));
"""
    actual = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e", program], cwd=root,
        input=json.dumps([[a.isoformat(), b.isoformat()] for a,b in cases]), text=True))
    assert len(actual) == len(cases)
    for (first, end), (observations, months, links_valid) in zip(cases, actual, strict=True):
        days = [first + timedelta(days=i) for i in range((end - first).days + 1)]
        month_ends = [d for d in days if d.day == calendar.monthrange(d.year,d.month)[1] or d==end]
        expected = [first] + [d for d in days[1:-1] if d.weekday()==calendar.SUNDAY or d in month_ends] + [end]
        assert observations == [d.isoformat() for d in expected], (first,end)
        assert months == [d.isoformat() for d in month_ends] and links_valid, (first,end)
    print(f"PASS: {len(cases)} schedules checked against Python calendar, 2023–2030, including month ends and leap dates")


if __name__ == "__main__":
    main()
