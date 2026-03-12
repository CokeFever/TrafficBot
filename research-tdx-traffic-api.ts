// Research TDX Traffic/Live API endpoints
import * as dotenv from 'dotenv';

dotenv.config();

const TDX_CLIENT_ID = process.env.TDX_CLIENT_ID || '';
const TDX_CLIENT_SECRET = process.env.TDX_CLIENT_SECRET || '';

if (!TDX_CLIENT_ID || !TDX_CLIENT_SECRET) {
  console.error('❌ Error: TDX_CLIENT_ID and TDX_CLIENT_SECRET must be set in .env file');
  console.error('Please copy .env.example to .env and fill in your TDX API credentials');
  process.exit(1);
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

async function getAccessToken(): Promise<string> {
  const tokenUrl = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: TDX_CLIENT_ID,
      client_secret: TDX_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

async function exploreTrafficAPIs() {
  console.log('🔍 Exploring TDX Traffic/Live APIs...\n');
  
  try {
    const token = await getAccessToken();
    console.log('✅ Got access token\n');
    
    // Test location: 台北市中心
    const latitude = 25.0330;
    const longitude = 121.5654;
    const radius = 1000;
    
    // Possible API endpoints to try
    const endpoints = [
      // Traffic Live/Real-time
      {
        name: 'Traffic Live (Basic)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Live',
      },
      {
        name: 'Traffic Live City (Taipei)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Live/City/Taipei',
      },
      // Traffic Incidents
      {
        name: 'Traffic Incident (Basic)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Incident',
      },
      {
        name: 'Traffic Incident City (Taipei)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Incident/City/Taipei',
      },
      // Road Conditions
      {
        name: 'Road Condition (Basic)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Road/Condition',
      },
      {
        name: 'Road Condition City (Taipei)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Road/Condition/City/Taipei',
      },
      // Traffic Events
      {
        name: 'Traffic Event (Basic)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Event',
      },
      {
        name: 'Traffic Event City (Taipei)',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Traffic/Event/City/Taipei',
      },
      // Highway
      {
        name: 'Highway Live Traffic',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Highway/Live',
      },
      {
        name: 'Highway Traffic',
        url: 'https://tdx.transportdata.tw/api/basic/v1/Highway/Traffic',
      },
      // Advanced API with spatial filter
      {
        name: 'Traffic Live NearBy (Advanced)',
        url: `https://tdx.transportdata.tw/api/advanced/v1/Traffic/Live/NearBy?$spatialFilter=nearby(${latitude},${longitude},${radius})&$format=JSON`,
      },
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n📍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);
      
      try {
        const response = await fetch(endpoint.url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json() as any;
          const dataArray = Array.isArray(data) ? data : (data.data || []);
          
          console.log(`   ✅ Success! Status: ${response.status}`);
          console.log(`   📊 Data type: ${Array.isArray(data) ? 'Array' : 'Object'}`);
          console.log(`   📦 Records: ${dataArray.length || 'N/A'}`);
          
          if (dataArray.length > 0) {
            console.log(`   🔍 Sample data keys:`, Object.keys(dataArray[0]).slice(0, 10).join(', '));
            console.log(`   📝 First record:`, JSON.stringify(dataArray[0], null, 2).substring(0, 500));
          }
        } else {
          console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

exploreTrafficAPIs();
