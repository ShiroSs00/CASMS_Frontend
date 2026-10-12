import { Redirect } from 'expo-router';
// P01 opens directly for the UI phase; P00 remains at /splash.
export default function AppEntry() { return <Redirect href="/login" />; }
