// Upload snapshot audio to Supabase Storage

import { supabase } from '@/app/lib/supabase';

/**
 * Upload snapshot audio to Supabase Storage
 * Returns the public URL of the uploaded file
 */
export async function uploadSnapshotAudio(
  audioBlob: Blob,
  profileId: string,
  letter: string,
  isNegative: boolean
): Promise<string | null> {
  try {
    // Generate unique filename: snapshots/{profileId}/{letter}/{timestamp}-{positive|negative}.wav
    const timestamp = Date.now();
    const type = isNegative ? 'negative' : 'positive';
    const fileName = `snapshots/${profileId}/${letter.toLowerCase()}/${timestamp}-${type}.wav`;

    console.log(`📤 Uploading snapshot audio: ${fileName} (${audioBlob.size} bytes)`);

    // Upload to Supabase Storage (bucket: 'audio')
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/wav',
        upsert: false // Don't overwrite if exists (unlikely due to timestamp)
      });

    if (error) {
      console.error('❌ Error uploading snapshot audio:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName);

    console.log(`✅ Snapshot audio uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Exception uploading snapshot audio:', error);
    return null;
  }
}
