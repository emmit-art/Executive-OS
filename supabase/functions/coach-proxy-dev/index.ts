import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { createHandler } from './handler.mjs';
Deno.serve(createHandler({createClient,env:(key: string)=>Deno.env.get(key)}));
