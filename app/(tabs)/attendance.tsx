import { Body, Card, Screen } from '../../src/components/ui';
import { en } from '../../src/locales/en';
export default function Attendance() {
  return (
    <Screen title={en.attendance} subtitle="MVP · upcoming module">
      <Card>
        <Body>{en.attendancePending}</Body>
      </Card>
    </Screen>
  );
}
