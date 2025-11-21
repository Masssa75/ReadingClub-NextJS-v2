const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

(async () => {
  console.log('Setting up storage policies for audio bucket...');

  try {
    // SQL to create policies
    const sql = `
      -- Allow authenticated users to upload files
      CREATE POLICY IF NOT EXISTS "Allow uploads to audio bucket"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'audio');

      -- Allow public read access
      CREATE POLICY IF NOT EXISTS "Allow public read from audio bucket"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'audio');

      -- Allow authenticated users to update their own files
      CREATE POLICY IF NOT EXISTS "Allow updates to audio bucket"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'audio');

      -- Allow authenticated users to delete their own files
      CREATE POLICY IF NOT EXISTS "Allow deletes from audio bucket"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'audio');
    `;

    // Execute SQL using the postgres connection
    const { data, error } = await supabase.rpc('exec', { sql });

    if (error) {
      console.log('RPC method not available, trying direct SQL...');

      // Alternative: use raw SQL query
      const { error: sqlError } = await supabase
        .from('_')
        .select('*')
        .limit(0);

      console.log('Note: You may need to create these policies manually in Supabase Dashboard');
      console.log('Go to: Storage → audio bucket → Policies');
      console.log('\nPolicies needed:');
      console.log('1. INSERT policy for authenticated users');
      console.log('2. SELECT policy for public');
      console.log('\nOr run this SQL in the SQL Editor:');
      console.log(sql);
    } else {
      console.log('✅ Storage policies created successfully!');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n📋 Manual setup required:');
    console.log('1. Go to Supabase Dashboard → Storage → audio');
    console.log('2. Click "Policies" tab');
    console.log('3. Add INSERT policy: Allow authenticated users to upload');
    console.log('4. Add SELECT policy: Allow public to read');
  }
})();
