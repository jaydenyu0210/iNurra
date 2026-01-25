import { Redirect } from 'expo-router';

export default function Index() {
    // This redirects to the auth flow; the layout will handle proper routing
    return <Redirect href="/(auth)/welcome" />;
}
