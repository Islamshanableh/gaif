/* eslint-disable */
const fs = require('fs');
const path = require('path');

const collectionPath = path.join(__dirname, '../GAIF_API_Collection.postman_collection.json');
const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeRequest(name, method, url, body, description) {
  const req = {
    name,
    request: {
      method,
      header: [
        {
          key: 'Content-Type',
          value: 'application/json',
        },
        {
          key: 'Authorization',
          value: 'Bearer {{accessToken}}',
        },
      ],
      url: {
        raw: url,
        host: url.startsWith('{{') ? [url.split('/')[0]] : ['{{baseUrl}}'],
        path: [],
      },
      description: description || '',
    },
    response: [],
  };

  // Parse the URL properly
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  const parts = withoutProtocol.split('/');
  req.request.url.host = [parts[0]];
  req.request.url.path = parts.slice(1).map(p => (p.startsWith(':') ? p : p));

  // Handle query params
  if (url.includes('?')) {
    const [base, queryStr] = url.split('?');
    const baseParts = base.replace(/^https?:\/\//, '').split('/');
    req.request.url.host = [baseParts[0]];
    req.request.url.path = baseParts.slice(1);
    req.request.url.query = queryStr.split('&').map(pair => {
      const [key, value] = pair.split('=');
      return { key, value: value || '', disabled: false };
    });
    req.request.url.raw = url;
  }

  if (body) {
    req.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: {
        raw: { language: 'json' },
      },
    };
  }

  return req;
}

// ─── 1. Update "Create Company Invoice" body ──────────────────────────────────

const ciFolder = collection.item.find(f => f.name === 'Company Invoice');
const createReq = ciFolder.item.find(i => i.name === 'Create Company Invoice');

createReq.request.body = {
  mode: 'raw',
  raw: JSON.stringify(
    {
      companyId: 1,
      registrationIds: [1, 2, 3],
      discount: 0,
      description: 'Company invoice for conference registrations',
      invoiceDate: '2026-03-01',
      dueDate: '2026-03-15',
      sendEmail: true,
    },
    null,
    2,
  ),
  options: { raw: { language: 'json' } },
};
createReq.request.description =
  'Create a company invoice linked to multiple registrations. ' +
  'Provide registrationIds[] to auto-compute totals per registration, ' +
  'or provide totalAmount for a manual amount. At least one is required.';

console.log('✓ Updated "Create Company Invoice" body');

// ─── 2. Add "Get Registration Items by Company Invoice" ───────────────────────

const alreadyHasRegItems = ciFolder.item.some(
  i => i.name === 'Get Registration Items by Company Invoice',
);

if (!alreadyHasRegItems) {
  const getRegItemsReq = makeRequest(
    'Get Registration Items by Company Invoice',
    'GET',
    '{{baseUrl}}/api/v1/company-invoices/{{companyInvoiceId}}/registrations',
    null,
    'Get all registration items (with individual invoice amounts) linked to a company invoice.',
  );
  ciFolder.item.push(getRegItemsReq);
  console.log('✓ Added "Get Registration Items by Company Invoice"');
} else {
  console.log('– "Get Registration Items by Company Invoice" already exists, skipped');
}

// ─── 3. Add Company Payment requests to Payment folder ───────────────────────

const payFolder = collection.item.find(f => f.name === 'Payment');

const newPaymentRequests = [
  {
    name: 'Initiate Company Checkout',
    method: 'GET',
    url: '{{baseUrl}}/api/v1/payment/company-checkout?invoiceId={{companyInvoiceId}}',
    body: null,
    description:
      'Creates a MEPS hosted checkout session for a company invoice and returns an HTML page ' +
      'that redirects the user to the payment gateway. ' +
      'The invoiceId must correspond to a CompanyInvoice with status != PAID.',
  },
  {
    name: 'Company Payment Result Callback',
    method: 'GET',
    url: '{{baseUrl}}/api/v1/payment/company-result?companyInvoiceId={{companyInvoiceId}}',
    body: null,
    description:
      'MEPS redirects to this endpoint after the company payment attempt. ' +
      'Verifies the order status with MEPS, marks the company invoice and all linked ' +
      'individual registrations as PAID, submits each to Fawaterkom, generates receipt PDFs ' +
      'and sends receipt emails to each participant.',
  },
  {
    name: 'Company Payment Success Page',
    method: 'GET',
    url: '{{baseUrl}}/payment/company-success?companyInvoiceId={{companyInvoiceId}}',
    body: null,
    description:
      'HTML success page shown after a successful company invoice payment. ' +
      'Served at /payment/company-success (not under /api/v1).',
  },
  {
    name: 'Company Payment Failed Page',
    method: 'GET',
    url: '{{baseUrl}}/payment/company-failed?companyInvoiceId={{companyInvoiceId}}&status=DECLINED',
    body: null,
    description:
      'HTML failure page shown after a failed/declined company invoice payment. ' +
      'Includes a retry link back to the company checkout. ' +
      'Served at /payment/company-failed (not under /api/v1).',
  },
];

newPaymentRequests.forEach(r => {
  const exists = payFolder.item.some(i => i.name === r.name);
  if (!exists) {
    payFolder.item.push(makeRequest(r.name, r.method, r.url, r.body, r.description));
    console.log(`✓ Added "${r.name}"`);
  } else {
    console.log(`– "${r.name}" already exists, skipped`);
  }
});

// ─── 4. Add companyInvoiceId variable ────────────────────────────────────────

if (!collection.variable) {
  collection.variable = [];
}

const hasCompanyInvoiceIdVar = collection.variable.some(v => v.key === 'companyInvoiceId');
if (!hasCompanyInvoiceIdVar) {
  collection.variable.push({
    key: 'companyInvoiceId',
    value: '1',
    type: 'string',
    description: 'ID of the company invoice (CompanyInvoice.id)',
  });
  console.log('✓ Added "companyInvoiceId" collection variable');
} else {
  console.log('– "companyInvoiceId" variable already exists, skipped');
}

// ─── 5. Add Meeting Room folder ───────────────────────────────────────────────

const meetingRoomFolderExists = collection.item.some(f => f.name === 'Meeting Room');

if (!meetingRoomFolderExists) {
  const meetingRoomFolder = {
    name: 'Meeting Room',
    item: [
      makeRequest(
        'Create Meeting Room',
        'POST',
        '{{baseUrl}}/api/v1/meeting-room',
        {
          type: 'room',
          floor: 'Ground Floor',
          name: 'Wadi Rum 1',
          banquet: '10',
          area: '50',
          code: 'WR1',
          priceUSD: 500,
          status: 'active',
        },
        'Create a new meeting room. type: room|table. status: active|inactive.',
      ),
      makeRequest(
        'Get Meeting Room List',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room?page=1&limit=20',
        null,
        'Get paginated list of meeting rooms. Optional filters: type, floor, status, page, limit.',
      ),
      makeRequest(
        'Get Meeting Room by ID',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room/{{meetingRoomId}}',
        null,
        'Get a single meeting room by ID.',
      ),
      makeRequest(
        'Update Meeting Room',
        'PUT',
        '{{baseUrl}}/api/v1/meeting-room/{{meetingRoomId}}',
        {
          name: 'Wadi Rum 1 Updated',
          floor: 'First Floor',
          banquet: '15',
          area: '60',
          priceUSD: 600,
          status: 'active',
        },
        'Update an existing meeting room by ID.',
      ),
      makeRequest(
        'Delete Meeting Room',
        'DELETE',
        '{{baseUrl}}/api/v1/meeting-room/{{meetingRoomId}}',
        null,
        'Soft delete a meeting room by ID.',
      ),
    ],
  };

  collection.item.push(meetingRoomFolder);
  console.log('✓ Added "Meeting Room" folder with 5 requests');
} else {
  console.log('– "Meeting Room" folder already exists, skipped');
}

// ─── 6. Add meetingRoomId variable ────────────────────────────────────────────

const hasMeetingRoomIdVar = collection.variable.some(v => v.key === 'meetingRoomId');
if (!hasMeetingRoomIdVar) {
  collection.variable.push({
    key: 'meetingRoomId',
    value: '1',
    type: 'string',
    description: 'ID of the meeting room',
  });
  console.log('✓ Added "meetingRoomId" collection variable');
} else {
  console.log('– "meetingRoomId" variable already exists, skipped');
}

// ─── Save ─────────────────────────────────────────────────────────────────────

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('\n✓ Collection saved to', collectionPath);
