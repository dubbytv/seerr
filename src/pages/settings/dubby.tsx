import SettingsDubby from '@app/components/Settings/SettingsDubby';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const DubbySettingsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_SETTINGS);
  return (
    <SettingsLayout>
      <SettingsDubby />
    </SettingsLayout>
  );
};

export default DubbySettingsPage;
