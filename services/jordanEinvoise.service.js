const axios = require('axios');
const { create } = require('xmlbuilder2');

// Fawaterkom API Configuration (URL is same for all companies)
const FAWATERKOM_API_URL = 'https://backend.jofotara.gov.jo/core/invoices/';

// Default credentials (fallback for testing only - will be replaced by company credentials)
const FAWATERKOM_CONFIG = {
  apiUrl: FAWATERKOM_API_URL,
  clientId: '9df81f5b-b761-4a7e-b953-273e43183054',
  secretKey:
    'Gj5nS9wyYHRadaVffz5VKB4v4wlVWyPhcJvrTD4NHtOA/jVg1tJ47zwLYt3mln/MsUcPrZ0mf1EgRw6hyB3knWAy+rHUZayXjqzi39T3e9cPDSCJlqtemEQzQctYMDiWG0tYGJg5DI11RSR4UF6lYULcqkhUh8bX8qTpNpNOcChkgPok1yOAN4JU8bLOSsehZcliNugtcHrB6dGVdc16OZgGx43609m6kGFygqHLrMrZ/Uio3OGwE5eSYvk9yFi0lJC10JUp18p0iI7NJqyiHw==',
};

/**
 * Generate UBL 2.1 compliant XML for Jordanian e-invoice
 */
function generateInvoiceXML(invoiceData) {
  // Validate required fields
  if (!invoiceData.TransactionNumber || !invoiceData.UUID) {
    throw new Error('Missing required fields: TransactionNumber or UUID');
  }

  // Parse date correctly
  const issueDate = invoiceData.TransactionDate
    ? invoiceData.TransactionDate.split(' ')[0]
    : new Date().toISOString().split('T')[0];

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
    xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'xmlns:cac':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'xmlns:cbc':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'xmlns:ext':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  });

  // Basic Invoice Information
  root.ele('cbc:ID').txt(invoiceData.TransactionNumber).up();
  root.ele('cbc:UUID').txt(invoiceData.UUID).up();
  root.ele('cbc:IssueDate').txt(issueDate).up();

  // Invoice Type Code - Jordan specific
  // 388 = Standard Invoice, 381 = Credit Note, 383 = Debit Note
  // Payment Method: 012 = Cash, 022 = Receivable/Credit
  let invoiceTypeCode = '388';
  let paymentMeans = '012';

  if (
    invoiceData.TransactionType === '1' ||
    invoiceData.TransactionType === 1
  ) {
    invoiceTypeCode = '388';
    if (
      invoiceData.PaymentMethod === 'cash' ||
      invoiceData.PaymentMethod === '012'
    ) {
      paymentMeans = '012';
    } else if (
      invoiceData.PaymentMethod === 'credit' ||
      invoiceData.PaymentMethod === 'receivable' ||
      invoiceData.PaymentMethod === '022'
    ) {
      paymentMeans = '022';
    } else {
      paymentMeans = invoiceData.PaymentMethod || '012';
    }
  } else if (
    invoiceData.TransactionType === '2' ||
    invoiceData.TransactionType === 2
  ) {
    invoiceTypeCode = '381';
    paymentMeans = '012';
  } else if (
    invoiceData.TransactionType === '3' ||
    invoiceData.TransactionType === 3
  ) {
    invoiceTypeCode = '383';
    paymentMeans = '012';
  }

  root
    .ele('cbc:InvoiceTypeCode', { name: paymentMeans })
    .txt(invoiceTypeCode)
    .up();
  root
    .ele('cbc:Note')
    .txt(invoiceData.Note || '')
    .up();
  root.ele('cbc:DocumentCurrencyCode').txt('JOD').up();
  root.ele('cbc:TaxCurrencyCode').txt('JOD').up();

  // Additional Document Reference (ICV - Invoice Counter Value)
  const additionalDoc = root.ele('cac:AdditionalDocumentReference');
  additionalDoc.ele('cbc:ID').txt('ICV').up();
  additionalDoc.ele('cbc:UUID').txt(invoiceData.TransactionNumber).up();
  additionalDoc.up();

  // Supplier Party (Your Company)
  const supplier = root.ele('cac:AccountingSupplierParty').ele('cac:Party');

  const supplierAddress = supplier.ele('cac:PostalAddress');
  supplierAddress.ele('cbc:StreetName').txt('N/A').up();
  supplierAddress.ele('cbc:CityName').txt('Amman').up();
  supplierAddress.ele('cbc:PostalZone').txt('11190').up();
  supplierAddress.ele('cbc:CountrySubentityCode').txt('JO-AM').up();
  supplierAddress
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt('JO')
    .up()
    .up();
  supplierAddress.up();

  const supplierTax = supplier.ele('cac:PartyTaxScheme');
  supplierTax
    .ele('cbc:CompanyID')
    .txt(invoiceData.TaxNumber || invoiceData.Items[0]?.TaxNumber || '')
    .up();
  supplierTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT').up().up();
  supplierTax.up();

  supplier
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(invoiceData.ClientName || '')
    .up()
    .up();
  supplier.up().up();

  // Customer Party
  const customer = root.ele('cac:AccountingCustomerParty').ele('cac:Party');

  customer
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: 'TN' })
    .txt('')
    .up()
    .up();

  const customerAddress = customer.ele('cac:PostalAddress');
  customerAddress.ele('cbc:StreetName').txt('N/A').up();
  customerAddress.ele('cbc:CityName').txt('N/A').up();
  customerAddress.ele('cbc:PostalZone').txt('N/A').up();
  customerAddress.ele('cbc:CountrySubentityCode').txt('JO-AM').up();
  customerAddress
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt('JO')
    .up()
    .up();
  customerAddress.up();

  const customerTax = customer.ele('cac:PartyTaxScheme');
  customerTax.ele('cbc:CompanyID').txt('').up();
  customerTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT').up().up();
  customerTax.up();

  customer
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt('')
    .up()
    .up();

  customer.ele('cac:Contact').ele('cbc:Telephone').txt('').up().up();
  customer.up().up();

  // SellerSupplierParty - Activity Number (Income Serial Number) goes HERE!
  const seller = root.ele('cac:SellerSupplierParty').ele('cac:Party');
  const sellerIdentification = seller.ele('cac:PartyIdentification');
  sellerIdentification
    .ele('cbc:ID')
    .txt(invoiceData.ActivityNumber || '')
    .up();
  sellerIdentification.up();
  seller.up().up();

  // Tax Total for General Tax (VAT)
  const taxTotal = root.ele('cac:TaxTotal');
  taxTotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(invoiceData.TotalTax || 0).toFixed(3))
    .up();

  const taxSubtotal = taxTotal.ele('cac:TaxSubtotal');
  taxSubtotal
    .ele('cbc:TaxableAmount', { currencyID: 'JOD' })
    .txt(parseFloat(invoiceData.Total || 0).toFixed(3))
    .up();
  taxSubtotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(invoiceData.TotalTax || 0).toFixed(3))
    .up();
  taxSubtotal
    .ele('cac:TaxCategory')
    .ele('cbc:ID')
    .txt('S')
    .up()
    .ele('cbc:Percent')
    .txt('16')
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt('VAT')
    .up()
    .up()
    .up();
  taxSubtotal.up();
  taxTotal.up();

  // Special Tax Total (0.000 if no special tax)
  const specialTaxTotal = root.ele('cac:TaxTotal');
  specialTaxTotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(invoiceData.SpecialTax || 0).toFixed(3))
    .up();
  specialTaxTotal.up();

  // AllowanceCharge - Discount section (REQUIRED even if 0)
  if (parseFloat(invoiceData.TotalDiscount || 0) > 0) {
    const allowanceCharge = root.ele('cac:AllowanceCharge');
    allowanceCharge.ele('cbc:ChargeIndicator').txt('false').up();
    allowanceCharge.ele('cbc:AllowanceChargeReason').txt('discount').up();
    allowanceCharge
      .ele('cbc:Amount', { currencyID: 'JOD' })
      .txt(parseFloat(invoiceData.TotalDiscount || 0).toFixed(3))
      .up();
    allowanceCharge.up();
  }

  // Legal Monetary Total - According to official documentation
  const monetary = root.ele('cac:LegalMonetaryTotal');

  // Calculate totals according to Jordan documentation (page 28)
  const lineExtension = parseFloat(invoiceData.Total || 0);
  const discount = parseFloat(invoiceData.TotalDiscount || 0);
  const tax = parseFloat(invoiceData.TotalTax || 0);

  // TaxExclusiveAmount = Total before discount (line extension)
  const taxExclusive = lineExtension;

  // TaxInclusiveAmount = (TaxExclusive - Discount + Tax)
  const taxInclusive = taxExclusive - discount + tax;

  // PayableAmount = same as TaxInclusive
  const payable = taxInclusive;

  monetary
    .ele('cbc:TaxExclusiveAmount', { currencyID: 'JOD' })
    .txt(taxExclusive.toFixed(3))
    .up();
  monetary
    .ele('cbc:TaxInclusiveAmount', { currencyID: 'JOD' })
    .txt(taxInclusive.toFixed(3))
    .up();
  monetary
    .ele('cbc:AllowanceTotalAmount', { currencyID: 'JOD' })
    .txt(discount.toFixed(3))
    .up();
  monetary
    .ele('cbc:PayableAmount', { currencyID: 'JOD' })
    .txt(payable.toFixed(3))
    .up();
  monetary.up();

  // Invoice Lines (Items)
  if (invoiceData.Items && Array.isArray(invoiceData.Items)) {
    invoiceData.Items.forEach((item, index) => {
      const line = root.ele('cac:InvoiceLine');
      line
        .ele('cbc:ID')
        .txt(String(item.RowNum || index + 1))
        .up();
      line
        .ele('cbc:InvoicedQuantity', { unitCode: 'PCE' })
        .txt(parseFloat(item.ItemQty || 1).toFixed(3))
        .up();

      // LineExtensionAmount = (Price × Qty) - Discount
      const lineExtension = parseFloat(item.ItemTotal || 0);
      line
        .ele('cbc:LineExtensionAmount', { currencyID: 'JOD' })
        .txt(lineExtension.toFixed(3))
        .up();

      // Tax Total for line item
      const lineTaxTotal = line.ele('cac:TaxTotal');

      // TaxAmount comes first
      lineTaxTotal
        .ele('cbc:TaxAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemTax || 0).toFixed(3))
        .up();

      // RoundingAmount = LineExtension + Tax (total including tax)
      const roundingAmount = lineExtension + parseFloat(item.ItemTax || 0);
      lineTaxTotal
        .ele('cbc:RoundingAmount', { currencyID: 'JOD' })
        .txt(roundingAmount.toFixed(3))
        .up();

      // TaxSubtotal
      const lineTaxSubtotal = lineTaxTotal.ele('cac:TaxSubtotal');
      lineTaxSubtotal
        .ele('cbc:TaxableAmount', { currencyID: 'JOD' })
        .txt(lineExtension.toFixed(3))
        .up();
      lineTaxSubtotal
        .ele('cbc:TaxAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemTax || 0).toFixed(3))
        .up();

      const taxCategory = lineTaxSubtotal.ele('cac:TaxCategory');
      taxCategory
        .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' })
        .txt('S')
        .up();
      taxCategory
        .ele('cbc:Percent')
        .txt(String(item.ItemTaxRate || 16))
        .up();
      taxCategory
        .ele('cac:TaxScheme')
        .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5153' })
        .txt('VAT')
        .up()
        .up();
      taxCategory.up();
      lineTaxSubtotal.up();
      lineTaxTotal.up();

      // Item details
      const itemNode = line.ele('cac:Item');
      itemNode
        .ele('cbc:Name')
        .txt(item.ItemName || 'N/A')
        .up();
      itemNode
        .ele('cac:ClassifiedTaxCategory')
        .ele('cbc:ID')
        .txt('S')
        .up()
        .ele('cbc:Percent')
        .txt(String(item.ItemTaxRate || 16))
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('VAT')
        .up()
        .up()
        .up();
      itemNode.up();

      // Price section
      const priceNode = line.ele('cac:Price');
      priceNode
        .ele('cbc:PriceAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemSalePriceExc || 0).toFixed(3))
        .up();

      // Add discount if present
      if (parseFloat(item.ItemDiscExc || 0) > 0) {
        const allowanceCharge = priceNode.ele('cac:AllowanceCharge');
        allowanceCharge.ele('cbc:ChargeIndicator').txt('false').up();
        allowanceCharge.ele('cbc:AllowanceChargeReason').txt('DISCOUNT').up();
        allowanceCharge
          .ele('cbc:Amount', { currencyID: 'JOD' })
          .txt(parseFloat(item.ItemDiscExc || 0).toFixed(3))
          .up();
        allowanceCharge.up();
      }

      priceNode.up();
      line.up();
    });
  }

  return root.end({ prettyPrint: true });
}

/**
 * Send invoice to Fawaterkom API
 * @param {Object} invoiceData - Invoice data
 * @param {Object} companyCredentials - Company credentials from API key auth
 */
async function sendInvoiceToFawaterkom(invoiceData, companyCredentials = null) {
  try {
    // Use company credentials if provided, otherwise fall back to default config
    const clientId = companyCredentials?.clientId || FAWATERKOM_CONFIG.clientId;
    const secretKey =
      companyCredentials?.secretKey || FAWATERKOM_CONFIG.secretKey;

    // Merge company data with invoice data (company data as defaults)
    const mergedInvoiceData = {
      ...invoiceData,
      TaxNumber: invoiceData.TaxNumber || companyCredentials?.taxNumber,
      ActivityNumber:
        invoiceData.ActivityNumber || companyCredentials?.activityNumber,
      ClientName: invoiceData.ClientName || companyCredentials?.companyName,
    };

    console.log(
      'Generating XML for invoice:',
      mergedInvoiceData.TransactionNumber,
    );
    console.log(
      'Using company credentials:',
      companyCredentials ? 'Yes' : 'No (default)',
    );

    // Generate XML
    const xmlString = generateInvoiceXML(mergedInvoiceData);

    // Convert to Base64
    const base64Invoice = Buffer.from(xmlString, 'utf-8').toString('base64');

    // Prepare request
    const requestBody = {
      invoice: base64Invoice,
    };

    // Send to API
    console.log('Sending to Fawaterkom API...');
    const response = await axios.post(FAWATERKOM_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Secret-Key': secretKey,
      },
      timeout: 30000,
    });

    console.log('Success! Invoice submitted');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error sending invoice to Fawaterkom:', error.message);

    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

/**
 * Generate UBL 2.1 compliant XML for Jordanian e-invoice REVERSAL (Credit Note)
 * This creates a Credit Note (فاتورة إرجاع) with InvoiceTypeCode 381
 */
function generateReverseInvoiceXML(reverseData) {
  // Validate required fields
  if (!reverseData.TransactionNumber || !reverseData.UUID) {
    throw new Error('Missing required fields: TransactionNumber or UUID');
  }

  if (!reverseData.OriginalInvoiceNumber) {
    throw new Error(
      'Missing required field: OriginalInvoiceNumber (reference to original invoice)',
    );
  }

  // Parse date correctly
  const issueDate = reverseData.TransactionDate
    ? reverseData.TransactionDate.split(' ')[0]
    : new Date().toISOString().split('T')[0];

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
    xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'xmlns:cac':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'xmlns:cbc':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'xmlns:ext':
      'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  });

  // Basic Invoice Information
  root.ele('cbc:ID').txt(reverseData.TransactionNumber).up();
  root.ele('cbc:UUID').txt(reverseData.UUID).up();
  root.ele('cbc:IssueDate').txt(issueDate).up();

  // Invoice Type Code for REVERSAL (Credit Note = 381)
  // Payment Method: 012 = Cash, 022 = Receivable/Credit (for income invoices)
  // Payment Method: 012 = Cash, 022 = Receivable/Credit (for general sales)
  // Payment Method: 013 = Cash, 023 = Receivable/Credit (for special tax)
  const invoiceTypeCode = '381'; // Credit Note for reversal
  let paymentMeans = '012'; // Default to cash

  if (
    reverseData.PaymentMethod === 'cash' ||
    reverseData.PaymentMethod === '012' ||
    reverseData.PaymentMethod === '011' ||
    reverseData.PaymentMethod === '013'
  ) {
    // Determine payment method based on invoice type
    if (reverseData.InvoiceType === 'income') {
      paymentMeans = '011';
    } else if (reverseData.InvoiceType === 'special') {
      paymentMeans = '013';
    } else {
      paymentMeans = '012'; // General sales (default)
    }
  } else if (
    reverseData.PaymentMethod === 'credit' ||
    reverseData.PaymentMethod === 'receivable' ||
    reverseData.PaymentMethod === '022' ||
    reverseData.PaymentMethod === '021' ||
    reverseData.PaymentMethod === '023'
  ) {
    // Determine payment method based on invoice type
    if (reverseData.InvoiceType === 'income') {
      paymentMeans = '021';
    } else if (reverseData.InvoiceType === 'special') {
      paymentMeans = '023';
    } else {
      paymentMeans = '022'; // General sales (default)
    }
  } else {
    paymentMeans = reverseData.PaymentMethod || '012';
  }

  root
    .ele('cbc:InvoiceTypeCode', { name: paymentMeans })
    .txt(invoiceTypeCode)
    .up();

  // Note with reference to original invoice
  const noteText = reverseData.Note
    ? `${reverseData.Note} - إرجاع فاتورة رقم: ${reverseData.OriginalInvoiceNumber}`
    : `إرجاع فاتورة رقم: ${reverseData.OriginalInvoiceNumber}`;
  root.ele('cbc:Note').txt(noteText).up();

  root.ele('cbc:DocumentCurrencyCode').txt('JOD').up();
  root.ele('cbc:TaxCurrencyCode').txt('JOD').up();

  // Billing Reference - Reference to original invoice being reversed (MUST come before AdditionalDocumentReference)
  const billingRef = root.ele('cac:BillingReference');
  const invoiceDocRef = billingRef.ele('cac:InvoiceDocumentReference');
  invoiceDocRef.ele('cbc:ID').txt(reverseData.OriginalInvoiceNumber).up();
  if (reverseData.OriginalInvoiceUUID) {
    invoiceDocRef.ele('cbc:UUID').txt(reverseData.OriginalInvoiceUUID).up();
  }
  // Original Invoice Total (required for credit notes)
  const originalTotal =
    parseFloat(reverseData.OriginalInvoiceTotal || reverseData.Total || 0) +
    parseFloat(reverseData.OriginalInvoiceTax || reverseData.TotalTax || 0);
  invoiceDocRef
    .ele('cbc:DocumentDescription')
    .txt(originalTotal.toFixed(3))
    .up();
  invoiceDocRef.up();
  billingRef.up();

  // Additional Document Reference (ICV - Invoice Counter Value)
  const additionalDoc = root.ele('cac:AdditionalDocumentReference');
  additionalDoc.ele('cbc:ID').txt('ICV').up();
  additionalDoc.ele('cbc:UUID').txt(reverseData.TransactionNumber).up();
  additionalDoc.up();

  // Supplier Party (Your Company)
  const supplier = root.ele('cac:AccountingSupplierParty').ele('cac:Party');

  const supplierAddress = supplier.ele('cac:PostalAddress');
  supplierAddress
    .ele('cbc:StreetName')
    .txt(reverseData.SupplierStreet || 'N/A')
    .up();
  supplierAddress
    .ele('cbc:CityName')
    .txt(reverseData.SupplierCity || 'Amman')
    .up();
  supplierAddress
    .ele('cbc:PostalZone')
    .txt(reverseData.SupplierPostalZone || '11190')
    .up();
  supplierAddress
    .ele('cbc:CountrySubentityCode')
    .txt(reverseData.SupplierCountryCode || 'JO-AM')
    .up();
  supplierAddress
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt('JO')
    .up()
    .up();
  supplierAddress.up();

  const supplierTax = supplier.ele('cac:PartyTaxScheme');
  supplierTax
    .ele('cbc:CompanyID')
    .txt(reverseData.TaxNumber || reverseData.Items[0]?.TaxNumber || '')
    .up();
  supplierTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT').up().up();
  supplierTax.up();

  supplier
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(reverseData.ClientName || '')
    .up()
    .up();
  supplier.up().up();

  // Customer Party
  const customer = root.ele('cac:AccountingCustomerParty').ele('cac:Party');

  const customerIdType = reverseData.CustomerIdType || 'TN';
  customer
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: customerIdType })
    .txt(reverseData.CustomerId || '')
    .up()
    .up();

  const customerAddress = customer.ele('cac:PostalAddress');
  customerAddress
    .ele('cbc:StreetName')
    .txt(reverseData.CustomerStreet || 'N/A')
    .up();
  customerAddress
    .ele('cbc:CityName')
    .txt(reverseData.CustomerCity || 'N/A')
    .up();
  customerAddress
    .ele('cbc:PostalZone')
    .txt(reverseData.CustomerPostalZone || 'N/A')
    .up();
  customerAddress
    .ele('cbc:CountrySubentityCode')
    .txt(reverseData.CustomerCountryCode || 'JO-AM')
    .up();
  customerAddress
    .ele('cac:Country')
    .ele('cbc:IdentificationCode')
    .txt('JO')
    .up()
    .up();
  customerAddress.up();

  const customerTax = customer.ele('cac:PartyTaxScheme');
  customerTax
    .ele('cbc:CompanyID')
    .txt(reverseData.CustomerTaxNumber || '')
    .up();
  customerTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT').up().up();
  customerTax.up();

  customer
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(reverseData.CustomerName || '')
    .up()
    .up();

  customer
    .ele('cac:Contact')
    .ele('cbc:Telephone')
    .txt(reverseData.CustomerPhone || '')
    .up()
    .up();
  customer.up().up();

  // SellerSupplierParty - Activity Number (Income Serial Number)
  const seller = root.ele('cac:SellerSupplierParty').ele('cac:Party');
  const sellerIdentification = seller.ele('cac:PartyIdentification');
  sellerIdentification
    .ele('cbc:ID')
    .txt(reverseData.ActivityNumber || '')
    .up();
  sellerIdentification.up();
  seller.up().up();

  // PaymentMeans with reason for credit note (required for reverse invoices)
  const reasonNote =
    reverseData.ReasonOfNote || reverseData.CreditNoteReason || 'إرجاع';
  const paymentMeansNode = root.ele('cac:PaymentMeans');
  paymentMeansNode.ele('cbc:PaymentMeansCode').txt('30').up(); // 30 = Credit transfer
  paymentMeansNode.ele('cbc:InstructionNote').txt(reasonNote).up();
  paymentMeansNode.up();

  // PaymentTerms
  const paymentTerms = root.ele('cac:PaymentTerms');
  paymentTerms.ele('cbc:Note').txt(reasonNote).up();
  paymentTerms.up();

  // Tax Total for General Tax (VAT)
  const taxTotal = root.ele('cac:TaxTotal');
  taxTotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(reverseData.TotalTax || 0).toFixed(3))
    .up();

  const taxSubtotal = taxTotal.ele('cac:TaxSubtotal');
  taxSubtotal
    .ele('cbc:TaxableAmount', { currencyID: 'JOD' })
    .txt(parseFloat(reverseData.Total || 0).toFixed(3))
    .up();
  taxSubtotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(reverseData.TotalTax || 0).toFixed(3))
    .up();
  taxSubtotal
    .ele('cac:TaxCategory')
    .ele('cbc:ID')
    .txt('S')
    .up()
    .ele('cbc:Percent')
    .txt(String(reverseData.TaxRate || 16))
    .up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID')
    .txt('VAT')
    .up()
    .up()
    .up();
  taxSubtotal.up();
  taxTotal.up();

  // Special Tax Total (0.000 if no special tax)
  const specialTaxTotal = root.ele('cac:TaxTotal');
  specialTaxTotal
    .ele('cbc:TaxAmount', { currencyID: 'JOD' })
    .txt(parseFloat(reverseData.SpecialTax || 0).toFixed(3))
    .up();
  specialTaxTotal.up();

  // AllowanceCharge - Discount section
  if (parseFloat(reverseData.TotalDiscount || 0) > 0) {
    const allowanceCharge = root.ele('cac:AllowanceCharge');
    allowanceCharge.ele('cbc:ChargeIndicator').txt('false').up();
    allowanceCharge.ele('cbc:AllowanceChargeReason').txt('discount').up();
    allowanceCharge
      .ele('cbc:Amount', { currencyID: 'JOD' })
      .txt(parseFloat(reverseData.TotalDiscount || 0).toFixed(3))
      .up();
    allowanceCharge.up();
  }

  // Legal Monetary Total
  const monetary = root.ele('cac:LegalMonetaryTotal');

  const lineExtension = parseFloat(reverseData.Total || 0);
  const discount = parseFloat(reverseData.TotalDiscount || 0);
  const tax = parseFloat(reverseData.TotalTax || 0);

  const taxExclusive = lineExtension;
  const taxInclusive = taxExclusive - discount + tax;
  const payable = taxInclusive;

  monetary
    .ele('cbc:TaxExclusiveAmount', { currencyID: 'JOD' })
    .txt(taxExclusive.toFixed(3))
    .up();
  monetary
    .ele('cbc:TaxInclusiveAmount', { currencyID: 'JOD' })
    .txt(taxInclusive.toFixed(3))
    .up();
  monetary
    .ele('cbc:AllowanceTotalAmount', { currencyID: 'JOD' })
    .txt(discount.toFixed(3))
    .up();
  monetary
    .ele('cbc:PayableAmount', { currencyID: 'JOD' })
    .txt(payable.toFixed(3))
    .up();
  monetary.up();

  // Invoice Lines (Items)
  if (reverseData.Items && Array.isArray(reverseData.Items)) {
    reverseData.Items.forEach((item, index) => {
      const line = root.ele('cac:InvoiceLine');
      line
        .ele('cbc:ID')
        .txt(String(item.RowNum || index + 1))
        .up();
      line
        .ele('cbc:InvoicedQuantity', { unitCode: 'PCE' })
        .txt(parseFloat(item.ItemQty || 1).toFixed(3))
        .up();

      const itemLineExtension = parseFloat(item.ItemTotal || 0);
      line
        .ele('cbc:LineExtensionAmount', { currencyID: 'JOD' })
        .txt(itemLineExtension.toFixed(3))
        .up();

      // Tax Total for line item
      const lineTaxTotal = line.ele('cac:TaxTotal');

      lineTaxTotal
        .ele('cbc:TaxAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemTax || 0).toFixed(3))
        .up();

      const roundingAmount = itemLineExtension + parseFloat(item.ItemTax || 0);
      lineTaxTotal
        .ele('cbc:RoundingAmount', { currencyID: 'JOD' })
        .txt(roundingAmount.toFixed(3))
        .up();

      const lineTaxSubtotal = lineTaxTotal.ele('cac:TaxSubtotal');
      lineTaxSubtotal
        .ele('cbc:TaxableAmount', { currencyID: 'JOD' })
        .txt(itemLineExtension.toFixed(3))
        .up();
      lineTaxSubtotal
        .ele('cbc:TaxAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemTax || 0).toFixed(3))
        .up();

      const taxCategory = lineTaxSubtotal.ele('cac:TaxCategory');
      taxCategory
        .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' })
        .txt('S')
        .up();
      taxCategory
        .ele('cbc:Percent')
        .txt(String(item.ItemTaxRate || 16))
        .up();
      taxCategory
        .ele('cac:TaxScheme')
        .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5153' })
        .txt('VAT')
        .up()
        .up();
      taxCategory.up();
      lineTaxSubtotal.up();
      lineTaxTotal.up();

      // Item details
      const itemNode = line.ele('cac:Item');
      itemNode
        .ele('cbc:Name')
        .txt(item.ItemName || 'N/A')
        .up();
      itemNode
        .ele('cac:ClassifiedTaxCategory')
        .ele('cbc:ID')
        .txt('S')
        .up()
        .ele('cbc:Percent')
        .txt(String(item.ItemTaxRate || 16))
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('VAT')
        .up()
        .up()
        .up();
      itemNode.up();

      // Price section
      const priceNode = line.ele('cac:Price');
      priceNode
        .ele('cbc:PriceAmount', { currencyID: 'JOD' })
        .txt(parseFloat(item.ItemSalePriceExc || 0).toFixed(3))
        .up();

      if (parseFloat(item.ItemDiscExc || 0) > 0) {
        const allowanceCharge = priceNode.ele('cac:AllowanceCharge');
        allowanceCharge.ele('cbc:ChargeIndicator').txt('false').up();
        allowanceCharge.ele('cbc:AllowanceChargeReason').txt('DISCOUNT').up();
        allowanceCharge
          .ele('cbc:Amount', { currencyID: 'JOD' })
          .txt(parseFloat(item.ItemDiscExc || 0).toFixed(3))
          .up();
        allowanceCharge.up();
      }

      priceNode.up();
      line.up();
    });
  }

  return root.end({ prettyPrint: true });
}

/**
 * Send REVERSE invoice (Credit Note) to Fawaterkom API
 * @param {Object} reverseData - Reverse invoice data
 * @param {Object} companyCredentials - Company credentials from API key auth
 */
async function reverseInvoiceToFawaterkom(
  reverseData,
  companyCredentials = null,
) {
  try {
    // Use company credentials if provided, otherwise fall back to default config
    const clientId = companyCredentials?.clientId || FAWATERKOM_CONFIG.clientId;
    const secretKey =
      companyCredentials?.secretKey || FAWATERKOM_CONFIG.secretKey;

    // Merge company data with reverse invoice data (company data as defaults)
    const mergedReverseData = {
      ...reverseData,
      TaxNumber: reverseData.TaxNumber || companyCredentials?.taxNumber,
      ActivityNumber:
        reverseData.ActivityNumber || companyCredentials?.activityNumber,
      ClientName: reverseData.ClientName || companyCredentials?.companyName,
    };

    console.log(
      'Generating Reverse Invoice XML for:',
      mergedReverseData.TransactionNumber,
    );
    console.log(
      'Original Invoice Reference:',
      mergedReverseData.OriginalInvoiceNumber,
    );
    console.log(
      'Using company credentials:',
      companyCredentials ? 'Yes' : 'No (default)',
    );

    // Generate XML for Credit Note
    const xmlString = generateReverseInvoiceXML(mergedReverseData);

    // Convert to Base64
    const base64Invoice = Buffer.from(xmlString, 'utf-8').toString('base64');

    // Prepare request
    const requestBody = {
      invoice: base64Invoice,
    };

    // Send to API
    console.log('Sending Reverse Invoice to Fawaterkom API...');
    const response = await axios.post(FAWATERKOM_API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': clientId,
        'Secret-Key': secretKey,
      },
      timeout: 30000,
    });

    console.log('Success! Reverse Invoice submitted');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error(
      'Error sending reverse invoice to Fawaterkom:',
      error.message,
    );

    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
}

/**
 * Simple example for reversing an invoice
 */
async function reverseInvoiceExample() {
  console.log('='.repeat(60));
  console.log('🔄 Fawaterkom Invoice REVERSAL Example');
  console.log('='.repeat(60));

  const reverseInvoice = {
    // New reverse invoice details
    TransactionNumber: 'REV-2025-001',
    UUID: 'B1234567-89AB-CDEF-0123-456789ABCDEF',
    TransactionDate: '2025-12-28 10:00:00',

    // Reference to original invoice being reversed
    OriginalInvoiceNumber: 'INV-2025-001',
    OriginalInvoiceUUID: 'A1234567-89AB-CDEF-0123-456789ABCDEF',

    // Payment method and invoice type
    PaymentMethod: '012', // 012 = Cash
    InvoiceType: 'general', // 'income', 'general', or 'special'

    // Seller/Supplier info
    ActivityNumber: '12681580',
    TaxNumber: '14122219',
    ClientName: 'شركه الهيثم للمخازن التجاريه',

    // Customer info (optional)
    CustomerName: '',
    CustomerId: '',
    CustomerIdType: 'TN',

    // Amounts (same as original invoice being reversed)
    Total: 100.0,
    TotalDiscount: 0.0,
    TotalTax: 16.0,
    SpecialTax: 0.0,
    TaxRate: 16,

    Note: 'إرجاع كامل للفاتورة',

    // Items (same as original invoice)
    Items: [
      {
        RowNum: 1,
        ItemName: 'Product A - منتج أ',
        ItemQty: 2.0,
        ItemSalePriceExc: 50.0,
        ItemDiscExc: 0.0,
        ItemTotal: 100.0,
        ItemTax: 16.0,
        ItemTaxRate: 16,
      },
    ],
  };

  console.log('\n📋 Reverse Invoice Details:');
  console.log(`   Reverse Invoice Number: ${reverseInvoice.TransactionNumber}`);
  console.log(
    `   Original Invoice Number: ${reverseInvoice.OriginalInvoiceNumber}`,
  );
  console.log(`   Date: ${reverseInvoice.TransactionDate}`);
  console.log(
    `   Total to Reverse: ${
      reverseInvoice.Total + reverseInvoice.TotalTax
    } JOD`,
  );

  console.log('\n🔄 Generating Reverse Invoice XML...');
  const xml = generateReverseInvoiceXML(reverseInvoice);
  console.log('✅ XML generated successfully');
  console.log(`   Length: ${xml.length} characters`);

  console.log('\n📤 Sending Reverse Invoice to Fawaterkom API...');
  const result = await reverseInvoiceToFawaterkom(reverseInvoice);

  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ SUCCESS! Reverse Invoice submitted successfully');
    console.log('Response:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ FAILED! Could not submit reverse invoice');
    console.log('Error:', JSON.stringify(result.error, null, 2));
  }
  console.log('='.repeat(60) + '\n');

  return result;
}

// Export functions
module.exports = {
  generateInvoiceXML,
  sendInvoiceToFawaterkom,
  FAWATERKOM_CONFIG,
  // New reverse invoice functions
  generateReverseInvoiceXML,
  reverseInvoiceToFawaterkom,
  reverseInvoiceExample,
};

// Run simple example if executed directly
if (require.main === module) {
  simpleExample()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('\n💥 Unexpected error:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
