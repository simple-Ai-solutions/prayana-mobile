import React from 'react';
import PackageForm, { EMPTY_PACKAGE } from './_components/PackageForm';

export default function NewPackageScreen() {
  return <PackageForm mode="create" initialValues={EMPTY_PACKAGE} headerTitle="New Package" />;
}
