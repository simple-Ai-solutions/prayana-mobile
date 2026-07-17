import React from 'react';
import ActivityForm, { EMPTY_ACTIVITY } from './_components/ActivityForm';

export default function NewActivityScreen() {
  return <ActivityForm mode="create" initialValues={EMPTY_ACTIVITY} headerTitle="New Activity" />;
}
