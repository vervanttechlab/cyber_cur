// The lab must behave like the real tools. These tests diff the simulated shell against:
//  1. real GNU tools + real Python run in Git Bash on the same files, and
//  2. the exact screens shown in the Day 2 demo videos (_build/video/demos.py).
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { newSession, run } from '../src/shell/shell';
import { demoLinux, demoWindows, seatHosts } from '../src/hosts/hosts';

const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';
const DEMO_DIR = resolve(__dirname, '../../Day_02_Computing_and_Network_Foundations/demo');

function real(cmd: string): string {
  const c = cmd.replace(/\bpython3\b/g, 'python -I');
  return execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${c}`], { cwd: DEMO_DIR, encoding: 'utf-8' }).replace(/\r\n/g, '\n');
}

describe('Linux text tools match real GNU tools and Python', () => {
  const cmds = [
    'wc -l demo_access.log',
    'head -n 3 demo_access.log',
    "awk '{print $1}' demo_access.log | sort | uniq -c | sort -rn",
    'grep 198.51.100.140 demo_access.log',
    'grep -i zgrab demo_access.log',
    "grep -i 'script' demo_access.log",
    'grep -c 404 ../assets/web_access.log',
    "awk '{print $9}' ../assets/web_access.log | sort | uniq -c | sort -rn",
    'grep -E "sqlmap|Nikto" ../assets/web_access.log',
    'grep -n uploads ../assets/web_access.log',
    "cut -d' ' -f1 ../assets/web_access.log | sort -u",
    "awk '$9 == 200 {print $1, $7}' ../assets/web_access.log",
    "awk '$9 ~ /^4/ {print $1, $9}' ../assets/web_access.log",
    "awk '/python-requests/ {print $1, $6, $7}' ../assets/web_access.log",
    'tail -n 2 auth_demo.log',
    'grep -v Failed auth_demo.log',
    "grep 'Failed password' auth_demo.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn",
    'grep -o "invalid user [a-z]*" auth_demo.log | sort | uniq -c',
    'wc -lw ../assets/web_access.log',
    'cat ../assets/log_counter.py | head -5',
    'python3 failed_login_counter.py auth_demo.log',
    'python3 ../assets/log_counter.py ../assets/web_access.log',
  ];
  for (const cmd of cmds) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(real(cmd));
    });
  }
});

// Read a Python string variable from demo1() in demos.py: either """...""" (optionally .strip('\n')) or "..."
const demosPy = readFileSync(resolve(__dirname, '../../_build/video/demos.py'), 'utf-8').replace(/\r\n/g, '\n');
function demoStr(name: string): string {
  const tq = demosPy.indexOf(`    ${name} = """`);
  if (tq >= 0) {
    const start = tq + `    ${name} = """`.length;
    const end = demosPy.indexOf('"""', start);
    return demosPy.slice(start, end);
  }
  const m = demosPy.match(new RegExp(`    ${name} = "([^"]*)"`));
  if (!m) throw new Error('not found ' + name);
  return m[1];
}
const norm = (s: string) => s.replace(/^\n+/, '').replace(/\n+$/, '');

describe('Demo hosts reproduce the Video 1 screens', () => {
  const W = (cmd: string) => norm(run(newSession(demoWindows()), cmd).stdout);
  const L = (cmd: string) => norm(run(newSession(demoLinux()), cmd).stdout);
  it('netstat -ano | findstr LISTENING', () => expect(W('netstat -ano | findstr LISTENING')).toBe(norm(demoStr('netstat'))));
  it('tasklist /svc /fi "PID eq 1180"', () => expect(W('tasklist /svc /fi "PID eq 1180"')).toBe(norm(demoStr('tasklist'))));
  it('ipconfig /all', () => expect(W('ipconfig /all')).toBe(norm(demoStr('ipconfig'))));
  it('systeminfo | findstr', () => expect(W('systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Boot Time"')).toBe(norm(demoStr('sysinfo'))));
  it('query user', () => expect(W('query user')).toBe(norm(demoStr('quser'))));
  it('Get-Process top 5 by CPU has the same processes as the video', () => {
    const out = W('Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, Id, CPU');
    const names = out.split('\n').slice(2).map((l) => l.trim().split(/\s+/)[0]);
    expect(names).toEqual(['MsMpEng', 'explorer', 'msedge', 'svchost', 'OneDrive']);
  });
  it('ss without sudo hides process names', () => expect(L('ss -tunap | grep LISTEN')).toBe(norm(demoStr('ss_user'))));
  it('sudo ss shows them', () => {
    const r = run(newSession(demoLinux()), 'sudo ss -tunap | grep LISTEN');
    expect(norm(r.stdout)).toBe(norm(demoStr('ss_root')));
    expect(r.stderr).toMatch(/\[sudo\] password/);
  });
  it('ps aux --sort=-%cpu | head -5', () => expect(L('ps aux --sort=-%cpu | head -5')).toBe(norm(demoStr('ps'))));
  it('ip route | grep default', () => expect(L('ip route | grep default')).toBe(norm(demoStr('iproute'))));
  it('hostnamectl has the video lines', () => { const o = L('hostnamectl'); for (const l of demoStr('hostnamectl').split('\n')) expect(o).toContain(l.trim()); });
  it('last -n 3', () => expect(run(newSession(demoLinux()), 'last -n 3').stdout.startsWith(demoStr('last'))).toBe(true));
});

describe('Shell behaviour', () => {
  it('unknown commands give a lab tip on each OS', () => {
    expect(run(newSession(demoLinux()), 'ipconfig').stderr).toMatch(/command not found[\s\S]*ip a/);
    expect(run(newSession(demoWindows()), 'grep x').stderr).toMatch(/not recognized[\s\S]*findstr/);
  });
  it('cd and relative paths work', () => {
    const s = newSession(demoLinux());
    run(s, 'cd ../assets');
    expect(run(s, 'pwd').stdout).toBe('/home/trainee/assets\n');
    expect(run(s, 'ls').stdout).toBe('lab_network_topology.txt  log_counter.py  web_access.log\n');
  });
  it('Windows paths are case-insensitive', () => {
    const s = newSession(demoWindows());
    expect(run(s, 'type ASSETS\\Web_Access.log').stdout).toContain('sqlmap');
    expect(run(s, 'findstr /i nikto assets\\web_access.log').stdout.split('\n').filter(Boolean)).toHaveLength(4);
  });
  it('redirect writes a file the trainee can read back', () => {
    const s = newSession(demoLinux());
    run(s, "awk '{print $1}' demo_access.log | sort -u > ips.txt");
    expect(run(s, 'wc -l ips.txt').stdout).toBe('6 ips.txt\n');
  });
  it('no internet from the lab', () => {
    expect(run(newSession(demoLinux()), 'ping 8.8.8.8').stderr).toMatch(/unreachable/);
    expect(run(newSession(demoLinux()), 'ping 10.10.20.1').stdout).toMatch(/4 received/);
  });
});

describe('Lab tips after a wrong path (the real error line stays unchanged)', () => {
  const lin = (cmd: string) => run(newSession(demoLinux()), cmd).stderr.split('\n');
  const win = (cmd: string) => run(newSession(demoWindows()), cmd).stderr.split('\n');
  it('file is in another folder (typed in ~/demo, file in ~/demo3)', () => {
    const [err, tip] = lin('cat demo_behavior_cards.txt');
    expect(err).toBe('cat: demo_behavior_cards.txt: No such file or directory');
    expect(tip).toBe('(Lab tip: There is no demo_behavior_cards.txt here. It is in ~/demo3: type the full path  ~/demo3/demo_behavior_cards.txt  (or  cd ~/demo3  first))');
    expect(lin('cut -d, -f1 scan_logs.csv | sort')[1]).toContain('~/day9/scan_logs.csv');
  });
  it('a folder where a file is needed', () => {
    expect(lin('cat ~/demo3')).toEqual(['cat: /home/trainee/demo3: Is a directory', '(Lab tip: ~/demo3 is a folder, not a file. See the files inside with:  ls ~/demo3)', '']);
  });
  it('spelling slips in the file or folder name', () => {
    expect(lin('cat demo_behavior__cards.txt')[1]).toBe('(Lab tip: Check the spelling. Did you mean  ~/demo3/demo_behavior_cards.txt ?)');
    expect(lin('cat ~/demo3/demo_behavior__cards.txt')[1]).toContain('Did you mean  ~/demo3/demo_behavior_cards.txt ?');
    expect(lin('cd ~/dmeo3')).toEqual(['bash: cd: /home/trainee/dmeo3: No such file or directory', '(Lab tip: Check the spelling. Did you mean  cd ~/demo3 ?)', '']);
  });
  it('nothing close: how to look around', () => {
    expect(lin('cat nothing_here.txt')[1]).toBe('(Lab tip: No file with that name in ~/demo. List the files with  ls ~/demo  (or  ls ~  to see every lab folder))');
  });
  it('Windows: wrong folder, spelling, cd', () => {
    expect(win('Import-Csv demo_scan_logs.csv')).toEqual(["Import-Csv : Could not find file 'C:\\Users\\trainee07\\demo_scan_logs.csv'.", '(Lab tip: There is no demo_scan_logs.csv here. It is in demo9: type the full path  demo9\\demo_scan_logs.csv  (or  cd demo9  first))', '']);
    expect(win('Import-Csv demo9\\demo_scan_log.csv')[1]).toBe('(Lab tip: Check the spelling. Did you mean  demo9\\demo_scan_logs.csv ?)');
    expect(win('cd demo99')[1]).toBe('(Lab tip: Check the spelling. Did you mean  cd demo9 ?)');
  });
  it('commands that work get no tip, and stdout is untouched', () => {
    const r = run(newSession(demoLinux()), 'cat ~/demo3/demo_behavior_cards.txt');
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('DEMO A');
  });
});

describe('Seat hosts are unique per trainee and consistent with their facts', () => {
  it('seat 12', () => {
    const { win, linux, facts } = seatHosts(12);
    expect(run(newSession(win), 'ipconfig').stdout).toContain(facts.win.ip);
    const listening = run(newSession(win), 'netstat -ano | findstr LISTENING').stdout.trim().split('\n');
    expect(listening).toHaveLength(facts.win.listening);
    expect(listening.join('\n')).toContain(':' + facts.win.unexpected.port);
    const ss = run(newSession(linux), 'sudo ss -tunap | grep LISTEN').stdout;
    expect(ss.trim().split('\n')).toHaveLength(facts.linux.listening);
    expect(ss).toContain(`"${facts.linux.unexpected.proc}"`);
  });
  it('different seats get different addresses and variants', () => {
    const a = seatHosts(1).facts, b = seatHosts(2).facts;
    expect(a.win.ip).not.toBe(b.win.ip);
    expect(a.win.unexpected.port).not.toBe(b.win.unexpected.port);
  });
});

describe('Day 3 and Day 4 Linux commands match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const cases: [string, string, string][] = [
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', "grep ':3389 ' firewall.log | awk '{print $6}' | cut -d= -f2 | cut -d: -f1 | sort | uniq -c"],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', "awk -F, '$3 == 4625 {print $5}' windows_security_events.csv | sort | uniq -c"],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', 'grep -E ",(4624|4688|4720|4732)," windows_security_events.csv'],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', 'grep 198.51.100.150 firewall.log | grep -v 3389'],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', 'cut -d, -f1,3,5,6 multi_source_alerts.csv'],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', 'grep -c ,4625, windows_security_events.csv'],
    ['Day_04_Security_Solutions_and_Log_Management/assets', 'day4', "grep DENY firewall.log | awk '{print $6, $7}'"],
    ['Day_03_Threat_Landscape_and_Attack_Frameworks/assets', 'day3', 'grep -n -iE "vssadmin|EncodedCommand|445|3333|1102" malware_behavior_cards.txt'],
    ['Day_03_Threat_Landscape_and_Attack_Frameworks/assets', 'day3', 'grep -c CARD malware_behavior_cards.txt'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(seatHosts(4).linux);
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 3 and Day 4 demo commands match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const D3 = 'Day_03_Threat_Landscape_and_Attack_Frameworks/demo', D4 = 'Day_04_Security_Solutions_and_Log_Management/demo';
  const cases: [string, string, string][] = [
    [D3, 'demo3', 'grep -A2 "^DEMO A" demo_behavior_cards.txt'],
    [D3, 'demo3', 'grep -A2 "DEMO" demo_behavior_cards.txt'],
    [D3, 'demo3', 'grep -n -B1 -A1 "log:" demo_incident_narrative.txt'],
    [D3, 'demo3', 'grep -n "log:" demo_incident_narrative.txt'],
    [D3, 'demo3', 'grep -C1 wscript demo_indicators.txt'],
    [D4, 'demo4', 'head -3 demo_firewall.log'],
    [D4, 'demo4', "grep ':445 ' demo_firewall.log | awk '{print $6}' | cut -d= -f2 | cut -d: -f1 | sort | uniq -c"],
    [D4, 'demo4', "awk -F, '$3 == 4625 {print $5}' demo_security_events.csv | sort | uniq -c"],
    [D4, 'demo4', 'grep -E ",(4624|5140|4688|4698)," demo_security_events.csv'],
    [D4, 'demo4', 'cut -d, -f1,3,5,6 demo_alerts.csv'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 5 commands (activities and demos) match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const A = 'Day_05_Checking_for_Alerts/assets', D = 'Day_05_Checking_for_Alerts/demo';
  const cases: [string, string, string][] = [
    [A, 'day5', 'grep -A7 "^A2" soc_alert_sop.txt'],
    [A, 'day5', 'grep -A20 "^SECTION C" soc_alert_sop.txt'],
    [A, 'day5', 'grep -A18 "^SECTION B" soc_alert_sop.txt'],
    [A, 'day5', 'grep ",New," alert_queue.csv | cut -d, -f1,2,6,7'],
    [A, 'day5', 'grep -E "^(=== REPORT|CHANNEL)" incident_reports.txt'],
    [A, 'day5', 'grep -A9 "REPORT IR-04" incident_reports.txt'],
    [A, 'day5', 'cut -d, -f2,5 edr_file_events.csv | sort | uniq -c'],
    [A, 'day5', 'grep ",Rename," edr_file_events.csv | cut -d, -f1,3,6,7 | head'],
    [A, 'day5', 'grep -E "README|vssadmin" edr_file_events.csv'],
    [A, 'day5', 'grep -c "lockd" edr_file_events.csv'],
    [D, 'demo5', 'grep -E "Ransom|Virus" demo_alert_queue.csv'],
    [D, 'demo5', 'grep -E "^(=== REPORT|CHANNEL)" demo_incident_reports.txt'],
    [D, 'demo5', 'grep -A7 "REPORT DR-2" demo_incident_reports.txt'],
    [D, 'demo5', 'cut -d, -f2,5 demo_edr_events.csv | sort | uniq -c'],
    [D, 'demo5', 'grep -c "crypt9" demo_edr_events.csv'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 6 commands (activities and demos) match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const A = 'Day_06_Alert_Triage_and_Ticketing/assets', D = 'Day_06_Alert_Triage_and_Ticketing/demo';
  const cases: [string, string, string][] = [
    [A, 'day6', 'grep -A22 "^STEP 1" soc_triage_sop.txt'],
    [A, 'day6', 'grep -A22 "PRIORITY MATRIX" soc_triage_sop.txt'],
    [A, 'day6', 'grep -A1 "^RT" soc_triage_sop.txt'],
    [A, 'day6', 'cat change_calendar.txt'],
    [A, 'day6', 'grep 203.0.113.20 asset_inventory.csv'],
    [A, 'day6', 'grep FIN-PC-03 alert_details.csv'],
    [A, 'day6', 'cat ticket_template.txt'],
    [A, 'day6', 'cut -d, -f1,2,3 alert_details.csv'],
    [D, 'demo6', 'grep D5-02 demo_alert_details.csv'],
    [D, 'demo6', 'cat demo_changes.txt'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 7 commands (activities and demos) match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const A = 'Day_07_Security_Solution_Status_Check/assets', D = 'Day_07_Security_Solution_Status_Check/demo';
  const cases: [string, string, string][] = [
    [A, 'day7', 'grep -A4 "Host type" soc_status_sop.txt'],
    [A, 'day7', 'grep -A8 "^B1" soc_status_sop.txt'],
    [A, 'day7', 'grep -A22 "^SECTION C" soc_status_sop.txt'],
    [A, 'day7', 'cut -d, -f1,3,4 endpoint_inventory.csv'],
    [A, 'day7', 'wc -l endpoint_inventory.csv coverage_report.csv'],
    [A, 'day7', 'grep -E "08:[0-2][0-9]|2026-10-" agent_health.csv'],
    [A, 'day7', 'grep LOAN-PC-08 security_policies.csv'],
    [D, 'demo7', 'cut -d, -f1,3,4 demo_endpoints.csv'],
    [D, 'demo7', 'grep "Not installed" demo_coverage.csv'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 8 text commands match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const A = 'Day_08_Manual_Checking_and_Verification/assets', D = 'Day_08_Manual_Checking_and_Verification/demo';
  const cases: [string, string, string][] = [
    [A, 'day8', 'grep -A12 "^V1  CHECK" soc_verification_sop.txt'],
    [A, 'day8', 'grep -A10 "^V2  CHECK" soc_verification_sop.txt'],
    [A, 'day8', 'cut -d, -f1,2,3,6 detections_to_verify.csv'],
    [A, 'day8', 'grep -i dd4fbfe5 threat_intel_hashes.txt known_good_hashes.txt'],
    [A, 'day8', 'grep -E "^111[89]," remediation_events.csv'],
    [A, 'day8', 'cat post_action_check.csv'],
    [D, 'demo8', 'cut -d, -f1,2,3,6 demo_detections.csv'],
    [D, 'demo8', 'grep -i "^0" demo_threat_intel.txt'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('Day 9 text commands match real GNU tools', () => {
  const realIn = (dir: string, cmd: string) => execFileSync(GIT_BASH, ['-c', `export LC_ALL=C; ${cmd}`], { cwd: resolve(__dirname, '../..', dir), encoding: 'utf-8' }).replace(/\r\n/g, '\n').replace(/\r/g, '');
  const A = 'Day_09_Case_Follow_up_and_Escalation/assets', D = 'Day_09_Case_Follow_up_and_Escalation/demo';
  const cases: [string, string, string][] = [
    [A, 'day9', 'grep -A18 "^F1  VERIFY" soc_followup_sop.txt'],
    [A, 'day9', 'grep -A10 "^F2  CHECK" soc_followup_sop.txt'],
    [A, 'day9', 'grep -A16 "^Check the rules" soc_followup_sop.txt'],
    [A, 'day9', 'cut -d, -f1,2,4,5 case_results.csv'],
    [A, 'day9', 'grep -A3 "CASE C-02" stakeholder_replies.txt'],
    [A, 'day9', 'grep -E ",(1118|1119|1002|1005|2001)," scan_logs.csv'],
    [D, 'demo9', 'cut -d, -f1,2,4,5 demo_case_results.csv'],
    [D, 'demo9', 'grep -E ",(1118|1119|1002|1005|2001)," demo_scan_logs.csv'],
  ];
  for (const [dir, labDir, cmd] of cases) {
    it(cmd, () => {
      const s = newSession(demoLinux());
      run(s, `cd ~/${labDir}`);
      const r = run(s, cmd);
      expect(r.stderr).toBe('');
      expect(r.stdout).toBe(realIn(dir, cmd));
    });
  }
});

describe('PowerShell Format-Table with a property list', () => {
  it('shows only the listed columns, in that order (like PowerShell)', () => {
    const out = run(newSession(demoWindows()), String.raw`Import-Csv demo5\demo_alert_queue.csv | Where-Object status -eq New | Format-Table severity, alert_id`).stdout;
    const lines = out.split('\n').filter((l) => l.trim());
    expect(lines[0]).toMatch(/^severity\s+alert_id\s*$/);
    expect(lines[1]).toMatch(/^-+\s+-+\s*$/);
    expect(lines.slice(2).map((l) => l.trim().split(/\s+/))).toEqual([['Low', 'D5-03'], ['High', 'D5-04'], ['High', 'D5-05'], ['Informational', 'D5-06']]);
    expect(out).not.toMatch(/rule_name|product/);
  });
  it('without a list it still shows every column', () => {
    const out = run(newSession(demoWindows()), String.raw`Import-Csv demo5\demo_alert_queue.csv | Format-Table`).stdout;
    expect(out).toMatch(/alert_id\s+received\s+source\s+product\s+rule_name/);
  });
});
