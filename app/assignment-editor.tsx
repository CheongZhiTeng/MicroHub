import { useLanguage } from '../src/locales/provider';
import { useLocalSearchParams, router } from 'expo-router';
import { Button, Notice, Screen } from '../src/components/ui';
import { Access } from '../src/features/access';
import { AssignmentEditor } from '../src/features/homework/editor';
import { useHomework } from '../src/features/homework/api';
import { FetchState } from '../src/features/homework/controls';
type ScopeProps = { club: boolean; scopes: { id: string; name: string }[] };
function Existing({
  id,
  copy,
  ...scope
}: { id: string; copy: boolean } & ScopeProps) {
  const { t } = useLanguage();
  const result = useHomework('hw_detail', { p_id: id });
  if (result.data === undefined)
    return <FetchState error={result.error} retry={result.refresh} />;
  if (
    !result.data ||
    !(result.data.can_manage ?? scope.club) ||
    (!copy && result.data.assignment.lifecycle !== 'draft')
  )
    return <Notice text={t('This draft is unavailable for editing.')} />;
  return (
    <AssignmentEditor key={id} initial={result.data} copy={copy} {...scope} />
  );
}
export default function Editor() {
  const { t } = useLanguage();
  const { id, copy, scope } = useLocalSearchParams<{
    id?: string;
    copy?: string;
    scope?: string;
  }>();
  const source = id || copy;
  const scopes = useHomework('hw_scopes');
  return (
    <Screen
      title={
        copy
          ? t('Copy assignment')
          : id
            ? t('Edit assignment')
            : t('Create assignment')
      }
    >
      <Access
        member
        signInParams={{ next: 'assignment-editor', id, copy, scope }}
      >
        {(user) =>
          !scopes.data && !scopes.error ? (
            <FetchState retry={scopes.refresh} />
          ) : user.role === 'member' && !scopes.data?.length ? (
            <Notice text={t('Assignment staff access is required.')} />
          ) : source ? (
            <Existing
              key={user.profile.id + source + Boolean(copy)}
              club={user.role !== 'member'}
              scopes={scopes.data ?? []}
              id={source}
              copy={Boolean(copy)}
            />
          ) : (
            <AssignmentEditor
              requestedScope={scope}
              club={user.role !== 'member'}
              scopes={scopes.data ?? []}
              key={user.profile.id}
            />
          )
        }
      </Access>
      <Button
        title={t('Back to assignments')}
        variant="ghost"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace('/homework')
        }
      />
    </Screen>
  );
}
