import { Body, Card, Screen } from '../../src/components/ui';
import { en } from '../../src/locales/en';
export default function Homework() {
  return (
    <Screen title={en.homework} subtitle="MVP · upcoming module">
      <Card>
        <Body>{en.homeworkPending}</Body>
      </Card>
    </Screen>
  );
}
