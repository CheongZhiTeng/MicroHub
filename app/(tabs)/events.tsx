import { Body, Card, Screen } from '../../src/components/ui';
import { en } from '../../src/locales/en';
export default function Events() {
  return (
    <Screen title={en.events} subtitle="V1 · planned">
      <Card>
        <Body>{en.eventsPending}</Body>
      </Card>
    </Screen>
  );
}
