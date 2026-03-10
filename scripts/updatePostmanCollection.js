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

// ─── 7. Add Meeting Room Reservation folder ───────────────────────────────────

const meetingRoomReservationFolderExists = collection.item.some(
  f => f.name === 'Meeting Room Reservation',
);

if (!meetingRoomReservationFolderExists) {
  const meetingRoomReservationFolder = {
    name: 'Meeting Room Reservation',
    item: [
      makeRequest(
        'Get Available Rooms',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room-reservation/rooms?page=1&limit=20',
        null,
        'Public. List available (unreserved) meeting rooms. Optional filters: type, floor, page, limit.',
      ),
      makeRequest(
        'Create Reservation',
        'POST',
        '{{baseUrl}}/api/v1/meeting-room-reservation',
        {
          meetingRoomId: 1,
          country: 'Jordan',
          company: 'Acme Corp',
          contactPerson: 'John Doe',
          email: 'john@example.com',
          mobile: '+962791234567',
          branding: false,
          description: 'Meeting room reservation for GAIF35',
        },
        'Public. Submit a meeting room reservation. The room becomes unavailable to others until admin deletes the request.',
      ),
      makeRequest(
        'Get Reservation List (Admin)',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room-reservation?page=1&limit=20',
        null,
        'Admin only. List all reservation requests.',
      ),
      makeRequest(
        'Delete Reservation (Admin)',
        'DELETE',
        '{{baseUrl}}/api/v1/meeting-room-reservation/{{meetingRoomReservationId}}',
        null,
        'Admin only. Delete a reservation request — frees the meeting room for others.',
      ),
    ],
  };

  collection.item.push(meetingRoomReservationFolder);
  console.log('✓ Added "Meeting Room Reservation" folder with 4 requests');
} else {
  console.log('– "Meeting Room Reservation" folder already exists, skipped');
}

// ─── 8. Add Meeting Room Invoice folder ───────────────────────────────────────

const meetingRoomInvoiceFolderExists = collection.item.some(
  f => f.name === 'Meeting Room Invoice',
);

if (!meetingRoomInvoiceFolderExists) {
  const meetingRoomInvoiceFolder = {
    name: 'Meeting Room Invoice',
    item: [
      makeRequest(
        'Create Meeting Room Invoice',
        'POST',
        '{{baseUrl}}/api/v1/meeting-room-invoice',
        {
          country: 'Jordan',
          company: 'Acme Corp',
          contactPerson: 'John Doe',
          email: 'john@example.com',
          mobile: '+962791234567',
          amountJD: 500,
          discount: 50,
          description: 'Meeting room booking for GAIF35 conference.',
        },
        'Admin only. Create a meeting room invoice. Generates serial number (GAIF26CM0001), converts JD → USD, generates PDF and sends invoice email with payment link automatically.',
      ),
      makeRequest(
        'Get Meeting Room Invoice List',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room-invoice?page=1&limit=20',
        null,
        'Admin only. List all meeting room invoices. Optional filter: status (pending|paid|cancelled).',
      ),
      makeRequest(
        'Get Meeting Room Invoice by ID',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room-invoice/{{meetingRoomInvoiceId}}',
        null,
        'Admin only. Get a single meeting room invoice by ID.',
      ),
      makeRequest(
        'Download Meeting Room Invoice PDF',
        'GET',
        '{{baseUrl}}/api/v1/meeting-room-invoice/{{meetingRoomInvoiceId}}/pdf',
        null,
        'Admin only. Download the invoice as a PDF file.',
      ),
      makeRequest(
        'Resend Meeting Room Invoice Email',
        'POST',
        '{{baseUrl}}/api/v1/meeting-room-invoice/{{meetingRoomInvoiceId}}/resend-email',
        null,
        'Admin only. Resend the invoice email with PDF attachment and payment link.',
      ),
      makeRequest(
        'Delete Meeting Room Invoice',
        'DELETE',
        '{{baseUrl}}/api/v1/meeting-room-invoice/{{meetingRoomInvoiceId}}',
        null,
        'Admin only. Permanently delete a meeting room invoice.',
      ),
    ],
  };

  collection.item.push(meetingRoomInvoiceFolder);
  console.log('✓ Added "Meeting Room Invoice" folder with 6 requests');
} else {
  console.log('– "Meeting Room Invoice" folder already exists, skipped');
}

// ─── 9. Add Meeting Room payment endpoints to Payment folder ──────────────────

const meetingRoomPaymentRequests = [
  {
    name: 'Initiate Meeting Room Checkout',
    method: 'GET',
    url: '{{baseUrl}}/api/v1/payment/meeting-room-checkout?invoiceId={{meetingRoomInvoiceId}}',
    body: null,
    description:
      'Creates a MEPS hosted checkout session for a meeting room invoice and returns an HTML page ' +
      'that redirects the user to the payment gateway. Currency: JOD.',
  },
  {
    name: 'Meeting Room Payment Result Callback',
    method: 'GET',
    url: '{{baseUrl}}/api/v1/payment/meeting-room-result?meetingRoomInvoiceId={{meetingRoomInvoiceId}}',
    body: null,
    description:
      'MEPS redirects to this endpoint after the meeting room payment attempt. ' +
      'Verifies order with MEPS and updates invoice status to "paid".',
  },
];

meetingRoomPaymentRequests.forEach(r => {
  const exists = payFolder.item.some(i => i.name === r.name);
  if (!exists) {
    payFolder.item.push(makeRequest(r.name, r.method, r.url, r.body, r.description));
    console.log(`✓ Added "${r.name}"`);
  } else {
    console.log(`– "${r.name}" already exists, skipped`);
  }
});

// ─── 10. Add new collection variables ─────────────────────────────────────────

const newVars = [
  {
    key: 'meetingRoomReservationId',
    value: '1',
    type: 'string',
    description: 'ID of the meeting room reservation',
  },
  {
    key: 'meetingRoomInvoiceId',
    value: '1',
    type: 'string',
    description: 'ID of the meeting room invoice (MeetingRoomInvoice.id)',
  },
];

newVars.forEach(v => {
  const exists = collection.variable.some(cv => cv.key === v.key);
  if (!exists) {
    collection.variable.push(v);
    console.log(`✓ Added "${v.key}" collection variable`);
  } else {
    console.log(`– "${v.key}" variable already exists, skipped`);
  }
});

// ─── Save ─────────────────────────────────────────────────────────────────────

fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
console.log('\n✓ Collection saved to', collectionPath);
