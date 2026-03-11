import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/utils.ts';

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Extract the JWT from the Authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const jwt = authHeader.replace('Bearer ', '');

        // 2. Create a Supabase client with the SERVICE ROLE KEY
        //    This bypasses RLS and allows admin actions.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // 3. Verify the user's identity using the JWT
        let user;
        let userId = '';

        // Handle Dev/Demo tokens for local development
        if (jwt === 'dev-token' || jwt === 'demo-token') {
            console.log(`[Delete Account] Detected dev/demo token: ${jwt}`);
            // Check if we are in a dev environment effectively by checking usage of these tokens
            const isDevToken = jwt === 'dev-token';
            userId = isDevToken ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002';
            user = { id: userId };
            console.log(`[Delete Account] Using hardcoded ID for dev/demo user: ${userId}`);
        } else {
            const { data: { user: authUser }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

            if (userError || !authUser) {
                console.error('[Delete Account] Auth failed:', userError?.message);
                return new Response(
                    JSON.stringify({ error: 'Unauthorized: ' + (userError?.message || 'Invalid token') }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            user = authUser;
            userId = user.id;
        }

        console.log(`[Delete Account] Verified user: ${userId}`);

        // 4. Delete the user from auth.users
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('[Delete Account] Failed to delete user:', deleteError.message);
            return new Response(
                JSON.stringify({ error: 'Failed to delete account: ' + deleteError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[Delete Account] Successfully deleted user: ${userId}`);

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('[Delete Account] Unexpected error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
