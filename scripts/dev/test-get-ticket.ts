import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

async function testGetTicket() {
  try {
    console.log('Testing GET /api/admin/811/cmpk7qo3l0000ayhwtj0pogx3...');
    const res = await fetch(`${API_BASE}/admin/811/cmpk7qo3l0000ayhwtj0pogx3`);
    const text = await res.text();
    
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    console.log(`Response preview: ${text.substring(0, 200)}`);
    
    if (res.status === 200) {
      try {
        const data = JSON.parse(text);
        console.log('✅ Successfully parsed JSON');
        console.log('Ticket:', data.ticketNumber);
      } catch (e) {
        console.error('❌ Failed to parse JSON');
        console.error('First 500 chars:', text.substring(0, 500));
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testGetTicket();
