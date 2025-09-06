export function computeBalance(worker = {}, entries = [], payments = []) {
  let bal = Number(worker.openingBalance || 0);

  // Add all entry amounts
  for (const e of entries) {
    const amt = Number(e.amount || 0);
    bal += amt;
  }

  // Subtract all payment amounts
  for (const p of payments) {
    const amt = Number(p.amount || 0);
    bal -= amt;
  }

  return bal;
}

export function getWorkerBalance(workerId, { workers, entries, payments }) {
  if (!workerId || !workers) return 0;
  
  const worker = workers.find(w => w.id === workerId);
  const openingBalance = Number(worker?.openingBalance ?? 0);

  // Entries: status logic with validation
  const sumEntries = (entries || [])
    .filter(e => e.workerId === workerId)
    .reduce((sum, e) => {
      const amt = Number(e.amount || 0);
      if (e.status === 'P') return sum + amt;
      if (e.status === 'H') return sum + amt / 2;
      // 'A' or anything else: ignore
      return sum;
    }, 0);

  // Payments: always subtract
  const sumPayments = (payments || [])
    .filter(p => p.workerId === workerId)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const finalBalance = openingBalance + sumEntries - sumPayments;

  return finalBalance;
}

/**
 * Get all worker balances efficiently
 * @param {Object} state - Global state containing workers, entries, payments
 * @returns {Object} Object with workerId as key and balance as value
 */
export function getAllWorkersBalances(state) {
  if (!state?.workers) return {};
  
  const balances = {};
  state.workers.forEach(worker => {
    balances[worker.id] = getWorkerBalance(worker.id, state);
  });
  
  return balances;
}

/**
 * Validate entry data before saving
 * @param {Object} entry - Entry object to validate
 * @param {Object} state - Global state for validation
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateEntry(entry, state) {
  if (!entry.workerId) {
    return { valid: false, error: "Worker is required" };
  }
  
  if (!entry.date) {
    return { valid: false, error: "Date is required" };
  }
  
  if (!['P', 'A', 'H'].includes(entry.status)) {
    return { valid: false, error: "Invalid attendance status" };
  }
  
  // Check for duplicate entries on same date
  const existingEntry = state.entries?.find(e => 
    e.workerId === entry.workerId && e.date === entry.date
  );
  
  if (existingEntry && existingEntry.id !== entry.id) {
    return { valid: false, error: "Attendance already recorded for this worker and date" };
  }
  
  // Validate non-absent entries
  if (entry.status !== 'A') {
    // Work A validation (existing logic)
    if (entry.workType === 'A' || !entry.workType) { // Default to Work A for backward compatibility
      if (!entry.categoryId) {
        return { valid: false, error: "Category is required for Work A entries" };
      }
      
      if (!entry.subcategoryId) {
        return { valid: false, error: "Subcategory is required for Work A entries" };
      }
      
      // Ensure subcategory exists and is mapped to the provided categoryId if mapping info present in state
      if (state && state.subcategories) {
        const sub = state.subcategories.find(s => s.id === entry.subcategoryId);
        if (!sub) return { valid: false, error: 'Selected subcategory not found' };
        const belongs = (sub.categoryIds && sub.categoryIds.includes(entry.categoryId)) || (sub.categoryId && sub.categoryId === entry.categoryId);
        if (!belongs) return { valid: false, error: 'Subcategory is not associated with selected category' };
      }
    }
    
    // Work B validation (new logic)
    if (entry.workType === 'B') {
      if (!entry.workName || entry.workName.trim() === '') {
        return { valid: false, error: "Work name is required for Work B entries" };
      }
      
      if (!entry.units || Number(entry.units) <= 0) {
        return { valid: false, error: "Valid units completed is required for Work B entries" };
      }
      
      if (!entry.ratePerUnit || Number(entry.ratePerUnit) <= 0) {
        return { valid: false, error: "Valid rate per unit is required for Work B entries" };
      }
    }
    
    if (!entry.amount || Number(entry.amount) <= 0) {
      return { valid: false, error: "Valid amount is required for non-absent entries" };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Validate payment data before saving
 * @param {Object} payment - Payment object to validate
 * @returns {Object} { valid: boolean, error: string }
 */
export function validatePayment(payment) {
  if (!payment.workerId) {
    return { valid: false, error: "Worker is required" };
  }
  
  if (!payment.date) {
    return { valid: false, error: "Date is required" };
  }
  
  if (!payment.amount || Number(payment.amount) <= 0) {
    return { valid: false, error: "Valid amount is required" };
  }
  
  if (!payment.paymentType) {
    return { valid: false, error: "Payment type is required" };
  }
  
  return { valid: true, error: null };
}

/**
 * Format balance for display with proper currency formatting
 * @param {number} balance - Balance amount
 * @returns {string} Formatted balance string
 */
export function formatBalance(balance) {
  const num = Number(balance || 0);
  const sign = num >= 0 ? '₹' : '-₹';
  const absValue = Math.abs(num);
  return `${sign}${absValue.toFixed(2)}`;
}
