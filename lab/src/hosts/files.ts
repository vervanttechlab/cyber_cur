// Lab files, imported straight from the curriculum folders so the lab never drifts from the activities.
import webAccessLog from '@curriculum/Day_02_Computing_and_Network_Foundations/assets/web_access.log?raw';
import logCounterPy from '@curriculum/Day_02_Computing_and_Network_Foundations/assets/log_counter.py?raw';
import topologyTxt from '@curriculum/Day_02_Computing_and_Network_Foundations/assets/lab_network_topology.txt?raw';
import demoAccessLog from '@curriculum/Day_02_Computing_and_Network_Foundations/demo/demo_access.log?raw';
import authDemoLog from '@curriculum/Day_02_Computing_and_Network_Foundations/demo/auth_demo.log?raw';
import failedLoginPy from '@curriculum/Day_02_Computing_and_Network_Foundations/demo/failed_login_counter.py?raw';

const lf = (s: string) => s.replace(/\r\n/g, '\n');

export const DAY2_ASSETS: Record<string, string> = {
  'lab_network_topology.txt': lf(topologyTxt),
  'log_counter.py': lf(logCounterPy),
  'web_access.log': lf(webAccessLog),
};

export const DAY2_DEMO: Record<string, string> = {
  'demo_access.log': lf(demoAccessLog),
  'auth_demo.log': lf(authDemoLog),
  'failed_login_counter.py': lf(failedLoginPy),
};

export function linuxSystemFiles(hostname: string, osName: string, user: string, ip: string): Record<string, string> {
  const ver = osName.match(/\d+\.\d+(\.\d+)?/)?.[0] ?? '24.04';
  const code = ver.startsWith('22') ? 'jammy' : 'noble';
  return {
    '/etc/hostname': hostname + '\n',
    '/etc/os-release': `PRETTY_NAME="${osName}"\nNAME="Ubuntu"\nVERSION_ID="${ver.split('.').slice(0, 2).join('.')}"\nVERSION="${ver} LTS (${code === 'noble' ? 'Noble Numbat' : 'Jammy Jellyfish'})"\nVERSION_CODENAME=${code}\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\n`,
    '/var/log/auth.log': [
      `Nov  5 07:42:31 ${hostname} sshd[901]: Server listening on 0.0.0.0 port 22.`,
      `Nov  5 07:58:12 ${hostname} sshd[2210]: Accepted password for ${user} from 10.10.20.57 port 50112 ssh2`,
      `Nov  5 07:58:12 ${hostname} sshd[2210]: pam_unix(sshd:session): session opened for user ${user}(uid=1000) by (uid=0)`,
      `Nov  5 08:15:40 ${hostname} sudo:  ${user} : TTY=pts/0 ; PWD=/home/${user} ; USER=root ; COMMAND=/usr/bin/ss -tunap`,
    ].join('\n') + '\n',
    [`/home/${user}/.bashrc`]: '# ~/.bashrc (lab)\n',
    [`/home/${user}/README.txt`]: `Welcome to ${hostname} (${ip}).\nLab files are in ~/assets. Type  help  to see the commands you can use.\n`,
  };
}

// ---------------------------------------------------------------- Day 3 and Day 4 lab files
import malwareCards from '@curriculum/Day_03_Threat_Landscape_and_Attack_Frameworks/assets/malware_behavior_cards.txt?raw';
import narrative from './generated/Incident_Narrative_Kill_Chain.txt?raw';
import firewallLog from '@curriculum/Day_04_Security_Solutions_and_Log_Management/assets/firewall.log?raw';
import winEventsCsv from '@curriculum/Day_04_Security_Solutions_and_Log_Management/assets/windows_security_events.csv?raw';
import alertsCsv from '@curriculum/Day_04_Security_Solutions_and_Log_Management/assets/multi_source_alerts.csv?raw';

export const DAY3_FILES: Record<string, string> = {
  'malware_behavior_cards.txt': lf(malwareCards),
  'Incident_Narrative_Kill_Chain.txt': lf(narrative),
};
export const DAY4_FILES: Record<string, string> = {
  'firewall.log': lf(firewallLog),
  'windows_security_events.csv': lf(winEventsCsv),
  'multi_source_alerts.csv': lf(alertsCsv),
};

// ---------------------------------------------------------------- Day 3 and Day 4 demo files (used by the demo videos and Practice missions)
import d3Cards from '@curriculum/Day_03_Threat_Landscape_and_Attack_Frameworks/demo/demo_behavior_cards.txt?raw';
import d3Cheat from '@curriculum/Day_03_Threat_Landscape_and_Attack_Frameworks/demo/malware_types_cheatsheet.txt?raw';
import d3Narr from '@curriculum/Day_03_Threat_Landscape_and_Attack_Frameworks/demo/demo_incident_narrative.txt?raw';
import d3Ind from '@curriculum/Day_03_Threat_Landscape_and_Attack_Frameworks/demo/demo_indicators.txt?raw';
import d4Alerts from '@curriculum/Day_04_Security_Solutions_and_Log_Management/demo/demo_alerts.csv?raw';
import d4Fw from '@curriculum/Day_04_Security_Solutions_and_Log_Management/demo/demo_firewall.log?raw';
import d4Ev from '@curriculum/Day_04_Security_Solutions_and_Log_Management/demo/demo_security_events.csv?raw';

// ---------------------------------------------------------------- Day 5 lab files and demo files
import d5Sop from '@curriculum/Day_05_Checking_for_Alerts/assets/soc_alert_sop.txt?raw';
import d5Queue from '@curriculum/Day_05_Checking_for_Alerts/assets/alert_queue.csv?raw';
import d5Reports from '@curriculum/Day_05_Checking_for_Alerts/assets/incident_reports.txt?raw';
import d5Edr from '@curriculum/Day_05_Checking_for_Alerts/assets/edr_file_events.csv?raw';
import d5dQueue from '@curriculum/Day_05_Checking_for_Alerts/demo/demo_alert_queue.csv?raw';
import d5dReports from '@curriculum/Day_05_Checking_for_Alerts/demo/demo_incident_reports.txt?raw';
import d5dEdr from '@curriculum/Day_05_Checking_for_Alerts/demo/demo_edr_events.csv?raw';

export const DAY5_FILES: Record<string, string> = {
  'soc_alert_sop.txt': lf(d5Sop), 'alert_queue.csv': lf(d5Queue), 'incident_reports.txt': lf(d5Reports), 'edr_file_events.csv': lf(d5Edr),
};
export const DAY5_DEMO: Record<string, string> = {
  'demo_alert_queue.csv': lf(d5dQueue), 'demo_incident_reports.txt': lf(d5dReports), 'demo_edr_events.csv': lf(d5dEdr),
};

// ---------------------------------------------------------------- Day 6 lab files and demo files
import d6Sop from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/soc_triage_sop.txt?raw';
import d6Assets from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/asset_inventory.csv?raw';
import d6Changes from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/change_calendar.txt?raw';
import d6Details from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/alert_details.csv?raw';
import d6Border from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/borderline_alerts.csv?raw';
import d6Ticket from '@curriculum/Day_06_Alert_Triage_and_Ticketing/assets/ticket_template.txt?raw';
import d6dAssets from '@curriculum/Day_06_Alert_Triage_and_Ticketing/demo/demo_assets.csv?raw';
import d6dDetails from '@curriculum/Day_06_Alert_Triage_and_Ticketing/demo/demo_alert_details.csv?raw';
import d6dBorder from '@curriculum/Day_06_Alert_Triage_and_Ticketing/demo/demo_borderline.csv?raw';
import d6dChanges from '@curriculum/Day_06_Alert_Triage_and_Ticketing/demo/demo_changes.txt?raw';

export const DAY6_FILES: Record<string, string> = {
  'soc_triage_sop.txt': lf(d6Sop), 'asset_inventory.csv': lf(d6Assets), 'change_calendar.txt': lf(d6Changes),
  'alert_details.csv': lf(d6Details), 'borderline_alerts.csv': lf(d6Border), 'ticket_template.txt': lf(d6Ticket),
};
export const DAY6_DEMO: Record<string, string> = {
  'demo_assets.csv': lf(d6dAssets), 'demo_alert_details.csv': lf(d6dDetails), 'demo_borderline.csv': lf(d6dBorder), 'demo_changes.txt': lf(d6dChanges),
};

// ---------------------------------------------------------------- Day 7 lab files and demo files
import d7Sop from '@curriculum/Day_07_Security_Solution_Status_Check/assets/soc_status_sop.txt?raw';
import d7End from '@curriculum/Day_07_Security_Solution_Status_Check/assets/endpoint_inventory.csv?raw';
import d7Cov from '@curriculum/Day_07_Security_Solution_Status_Check/assets/coverage_report.csv?raw';
import d7Health from '@curriculum/Day_07_Security_Solution_Status_Check/assets/agent_health.csv?raw';
import d7Pol from '@curriculum/Day_07_Security_Solution_Status_Check/assets/security_policies.csv?raw';
import d7Det from '@curriculum/Day_07_Security_Solution_Status_Check/assets/open_detections.csv?raw';
import d7dEnd from '@curriculum/Day_07_Security_Solution_Status_Check/demo/demo_endpoints.csv?raw';
import d7dCov from '@curriculum/Day_07_Security_Solution_Status_Check/demo/demo_coverage.csv?raw';
import d7dHealth from '@curriculum/Day_07_Security_Solution_Status_Check/demo/demo_agent_health.csv?raw';

export const DAY7_FILES: Record<string, string> = {
  'soc_status_sop.txt': lf(d7Sop), 'endpoint_inventory.csv': lf(d7End), 'coverage_report.csv': lf(d7Cov),
  'agent_health.csv': lf(d7Health), 'security_policies.csv': lf(d7Pol), 'open_detections.csv': lf(d7Det),
};
export const DAY7_DEMO: Record<string, string> = { 'demo_endpoints.csv': lf(d7dEnd), 'demo_coverage.csv': lf(d7dCov), 'demo_agent_health.csv': lf(d7dHealth) };

// ---------------------------------------------------------------- Day 9 lab files and demo files
import d9Sop from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/soc_followup_sop.txt?raw';
import d9Cases from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/case_results.csv?raw';
import d9Dir from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/stakeholder_directory.csv?raw';
import d9Rep from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/stakeholder_replies.txt?raw';
import d9Scan from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/scan_logs.csv?raw';
import d9Tpl from '@curriculum/Day_09_Case_Follow_up_and_Escalation/assets/escalation_template.txt?raw';
import d9dCases from '@curriculum/Day_09_Case_Follow_up_and_Escalation/demo/demo_case_results.csv?raw';
import d9dRep from '@curriculum/Day_09_Case_Follow_up_and_Escalation/demo/demo_replies.txt?raw';
import d9dScan from '@curriculum/Day_09_Case_Follow_up_and_Escalation/demo/demo_scan_logs.csv?raw';

export const DAY9_FILES: Record<string, string> = {
  'soc_followup_sop.txt': lf(d9Sop), 'case_results.csv': lf(d9Cases), 'stakeholder_directory.csv': lf(d9Dir),
  'stakeholder_replies.txt': lf(d9Rep), 'scan_logs.csv': lf(d9Scan), 'escalation_template.txt': lf(d9Tpl),
};
export const DAY9_DEMO: Record<string, string> = { 'demo_case_results.csv': lf(d9dCases), 'demo_replies.txt': lf(d9dRep), 'demo_scan_logs.csv': lf(d9dScan) };

// ---------------------------------------------------------------- Day 8 lab files and demo files (samples/ are harmless text placeholders)
import d8s1 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/samples/V-01_invoice_scan.exe.sample?raw';
import d8s2 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/samples/V-02_putty.exe.sample?raw';
import d8s3 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/samples/V-03_payslip_viewer.exe.sample?raw';
import d8s4 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/samples/V-04_svcupd.exe.sample?raw';
import d8s5 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/samples/V-05_sync.exe.sample?raw';
import d8ds1 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/samples/DV-1_winhelper.exe.sample?raw';
import d8ds2 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/samples/DV-2_gradebook_sync.exe.sample?raw';
import d8ds3 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/samples/DV-3_photoeditor_setup.exe.sample?raw';
import d8a1 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/soc_verification_sop.txt?raw';
import d8a2 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/detections_to_verify.csv?raw';
import d8a3 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/threat_intel_hashes.txt?raw';
import d8a4 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/known_good_hashes.txt?raw';
import d8a5 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/remediation_events.csv?raw';
import d8a6 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/post_action_check.csv?raw';
import d8a7 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/vendor_bulletin.txt?raw';
import d8a8 from '@curriculum/Day_08_Manual_Checking_and_Verification/assets/update_status.csv?raw';
import d8d1 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/demo_detections.csv?raw';
import d8d2 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/demo_threat_intel.txt?raw';
import d8d3 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/demo_remediation_events.csv?raw';
import d8d4 from '@curriculum/Day_08_Manual_Checking_and_Verification/demo/demo_post_check.csv?raw';

export const DAY8_FILES: Record<string, string> = {
  'samples/V-01_invoice_scan.exe.sample': lf(d8s1),
  'samples/V-02_putty.exe.sample': lf(d8s2),
  'samples/V-03_payslip_viewer.exe.sample': lf(d8s3),
  'samples/V-04_svcupd.exe.sample': lf(d8s4),
  'samples/V-05_sync.exe.sample': lf(d8s5),
  'soc_verification_sop.txt': lf(d8a1),
  'detections_to_verify.csv': lf(d8a2),
  'threat_intel_hashes.txt': lf(d8a3),
  'known_good_hashes.txt': lf(d8a4),
  'remediation_events.csv': lf(d8a5),
  'post_action_check.csv': lf(d8a6),
  'vendor_bulletin.txt': lf(d8a7),
  'update_status.csv': lf(d8a8),
};
export const DAY8_DEMO: Record<string, string> = {
  'samples/DV-1_winhelper.exe.sample': lf(d8ds1),
  'samples/DV-2_gradebook_sync.exe.sample': lf(d8ds2),
  'samples/DV-3_photoeditor_setup.exe.sample': lf(d8ds3),
  'demo_detections.csv': lf(d8d1),
  'demo_threat_intel.txt': lf(d8d2),
  'demo_remediation_events.csv': lf(d8d3),
  'demo_post_check.csv': lf(d8d4),
};

export const DAY3_DEMO: Record<string, string> = {
  'demo_behavior_cards.txt': lf(d3Cards), 'malware_types_cheatsheet.txt': lf(d3Cheat),
  'demo_incident_narrative.txt': lf(d3Narr), 'demo_indicators.txt': lf(d3Ind),
};
export const DAY4_DEMO: Record<string, string> = {
  'demo_alerts.csv': lf(d4Alerts), 'demo_firewall.log': lf(d4Fw), 'demo_security_events.csv': lf(d4Ev),
};
