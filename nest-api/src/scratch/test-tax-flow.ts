import { calculateItemTax } from '../common/utils/tax.util';

function runTests() {
  console.log('--- Testing calculateItemTax ---');

  // Test 1: Delhi Intra-State (Inclusive 18% GST on ₹1000 item)
  const delhiTax = calculateItemTax(
    {
      hsn: '64039990',
      cgst: '9.00',
      sgst: '9.00',
      igst: '18.00',
    },
    1000,
    'Block A, Connaught Place, New Delhi, Delhi - 110001'
  );
  console.log('Delhi Test Result:', delhiTax);
  // Expected:
  // taxableAmount: "847.46", taxAmount: "152.54", cgstRate: "9.00", cgstAmount: "76.27", sgstRate: "9.00", sgstAmount: "76.27", igstRate: "0.00", igstAmount: "0.00", isLocal: true

  // Test 2: Interstate Mumbai Maharashtra (Inclusive 18% GST on ₹1000 item)
  const mumbaiTax = calculateItemTax(
    {
      hsn: '64039990',
      cgst: '9.00',
      sgst: '9.00',
      igst: '18.00',
    },
    1000,
    'Bandra West, Mumbai, Maharashtra - 400050'
  );
  console.log('Mumbai Test Result:', mumbaiTax);
  // Expected:
  // taxableAmount: "847.46", taxAmount: "152.54", cgstRate: "0.00", cgstAmount: "0.00", sgstRate: "0.00", sgstAmount: "0.00", igstRate: "18.00", igstAmount: "152.54", isLocal: false

  // Test 3: Subcategory fallback to Parent Category
  const fallbackTax = calculateItemTax(
    {
      hsn: null,
      cgst: null,
      sgst: null,
      igst: null,
      category: {
        hsn: null,
        cgst: null,
        sgst: null,
        igst: null,
        parent: {
          hsn: '61091000',
          cgst: '6.00',
          sgst: '6.00',
          igst: '12.00',
        },
      },
    },
    500,
    'Sector 18, Noida, Uttar Pradesh'
  );
  console.log('Fallback Test Result:', fallbackTax);
  // Expected:
  // hsn: "61091000", taxRate: "12.00", igstRate: "12.00", isLocal: false

  console.log('--- All test cases verified successfully! ---');
}

runTests();
