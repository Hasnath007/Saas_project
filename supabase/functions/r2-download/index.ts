import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_ENDPOINT = 'https://8cbf5db8bbc06a9fa335441e4799cfbe.r2.cloudflarestorage.com';
const R2_BUCKET = 'rentt-ai-bucket';

// AWS Signature V4 signing - using ArrayBuffer directly
async function hmac(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : new Uint8Array(key);
  const msgData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, msgData);
}

async function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Promise<ArrayBuffer> {
  const kDate = await hmac('AWS4' + key, dateStamp);
  const kRegion = await hmac(kDate, regionName);
  const kService = await hmac(kRegion, serviceName);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      throw new Error('No file path provided');
    }

    console.log('Downloading file:', filePath);

    // Prepare AWS Signature V4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const canonicalUri = `/${R2_BUCKET}/${filePath}`;
    const canonicalQuerystring = '';
    const host = R2_ENDPOINT.replace('https://', '');

    const payloadHash = await sha256('');

    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    const signingKey = await getSignatureKey(R2_SECRET_ACCESS_KEY!, dateStamp, region, service);
    const signatureBuffer = await hmac(signingKey, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Download from R2
    const downloadResponse = await fetch(`${R2_ENDPOINT}${canonicalUri}`, {
      method: 'GET',
      headers: {
        'Authorization': authorizationHeader,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
      },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('R2 download error:', errorText);
      throw new Error(`R2 download failed: ${downloadResponse.status} - ${errorText}`);
    }

    const fileBlob = await downloadResponse.blob();
    const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';

    console.log('File downloaded successfully:', filePath);

    return new Response(fileBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filePath.split('/').pop()}"`,
      },
    });
  } catch (error) {
    console.error('Error in r2-download function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});