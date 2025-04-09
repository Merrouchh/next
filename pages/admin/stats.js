import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import { fetchShiftReports } from '../../utils/api';
import styles from '../../styles/AdminStats.module.css';
import { 
  FaChartLine, 
  FaCalendarAlt, 
  FaMoneyBillWave, 
  FaExchangeAlt, 
  FaClock, 
  FaSearch, 
  FaSpinner, 
  FaUser, 
  FaExclamationTriangle,
  FaUndo,
  FaArrowDown,
  FaCalculator,
  FaWallet,
  FaHandHoldingUsd
} from 'react-icons/fa';

export default function AdminStats() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    dateFrom: getTodayAt7AM(),
    dateTo: getTomorrowAt7AM()
  });
  const [reportType, setReportType] = useState(2); // Default to detailed report
  const [shiftReports, setShiftReports] = useState(null);

  // Helper function to get today at 7am
  function getTodayAt7AM() {
    const date = new Date();
    // If current time is before 7am, use yesterday 7am
    if (date.getHours() < 7) {
      date.setDate(date.getDate() - 1);
    }
    date.setHours(7, 0, 0, 0);
    return formatDateForInput(date);
  }

  // Helper function to get tomorrow at 7am
  function getTomorrowAt7AM() {
    const date = new Date();
    // If current time is before 7am, use today 7am
    if (date.getHours() < 7) {
      date.setDate(date.getDate());
    } else {
      date.setDate(date.getDate() + 1);
    }
    date.setHours(7, 0, 0, 0);
    return formatDateForInput(date);
  }

  // Format date for input element
  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  // Format currency
  function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-MA', {
      style: 'currency',
      currency: 'MAD',
      minimumFractionDigits: 2
    }).format(amount);
  }

  // Format duration (convert minutes to hours and minutes)
  function formatDuration(minutes) {
    if (!minutes || isNaN(minutes)) return '0h 0m';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  // Format date for display
  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Process shifts to calculate differences between consecutive shifts
  const processShifts = (shifts) => {
    if (!shifts || shifts.length < 2) return shifts;
    
    // Sort shifts by start time
    const sortedShifts = [...shifts].sort((a, b) => 
      new Date(a.startTime) - new Date(b.startTime)
    );
    
    // Calculate between-shift differences
    return sortedShifts.map((shift, index) => {
      // For all shifts except the first one
      if (index > 0) {
        const prevShift = sortedShifts[index - 1];
        // Only calculate if previous shift is closed and has an actual end amount
        if (!prevShift.isActive && Number.isFinite(prevShift.actual)) {
          // Calculate how much cash was removed between shifts
          // A negative number means cash was removed (what we expect)
          // A positive number means cash was added (unusual)
          const betweenShiftsDiff = shift.startCash - prevShift.actual;
          
          // Calculate the cash out amount (how much the operator took out)
          // If the difference is negative, that's the amount taken out
          const cashOutAmount = betweenShiftsDiff < 0 ? Math.abs(betweenShiftsDiff) : 0;
          
          return {
            ...shift,
            betweenShiftsDiff,
            cashOutAmount,
            prevShiftEndCash: prevShift.actual
          };
        }
      }
      return shift;
    });
  };

  // Load shift reports
  async function loadShiftReports() {
    if (!dateRange.dateFrom || !dateRange.dateTo) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create Date objects from the string dates
      const fromDate = new Date(dateRange.dateFrom);
      const toDate = new Date(dateRange.dateTo);
      
      // Set times for proper range - beginning and end of days
      fromDate.setHours(7, 0, 0, 0);
      toDate.setHours(7, 0, 0, 0);
      
      try {
        // Pass the reportType parameter
        const response = await fetchShiftReports(fromDate, toDate, reportType);
        console.log('Shift reports data:', response);
        
        if (response && response.result && response.httpStatusCode === 200) {
          console.log('Setting shift reports data:', response.result);
          
          // Process shifts to add between-shifts differences
          if (response.result.shifts && response.result.shifts.length > 0) {
            response.result.shifts = processShifts(response.result.shifts);
          }
          
          setShiftReports(response.result);
        } else if (response && response.isError) {
          setShiftReports(null);
          setError(`API Error: ${response.message || 'Unknown error'}`);
        } else {
          // We got some response but not in expected format
          console.error('Unexpected API response format:', response);
          setError('Invalid response format from API');
        }
      } catch (apiError) {
        console.error('API Error details:', apiError);
        setError(`API Error: ${apiError.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error loading shift reports:', err);
      setError('Failed to load shift reports: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  // Load reports on initial page load
  useEffect(() => {
    loadShiftReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate summary values
  function calculateSummary() {
    if (!shiftReports || !shiftReports.shifts || shiftReports.shifts.length === 0) {
      return {
        totalSales: 0,
        totalDifference: 0,
        totalDuration: '0h 0m',
        totalRefunds: 0,
        totalPayouts: 0,
        activeShiftExpected: 0,
        totalCashOut: 0,
        totalCashPayouts: 0
      };
    }

    console.log('Calculating summary from:', {
      totalExpectedExcludingStartCash: shiftReports.totalExpectedExcludingStartCash,
      totalDifference: shiftReports.totalDifference,
      totalDuration: shiftReports.totalDuration
    });

    // Find active shift (or the last shift if none are active)
    const activeShift = shiftReports.shifts.find(shift => shift.isActive) || 
                        shiftReports.shifts[shiftReports.shifts.length - 1];
    
    const activeShiftExpected = activeShift ? activeShift.expected || 0 : 0;

    // For custom calculations from all shifts (active and closed)
    const calculatedTotals = shiftReports.shifts.reduce((acc, shift) => {
      // Calculate cash payouts from payment method details if available
      let shiftCashPayouts = 0;
      let shiftTotalPayouts = 0;
      
      if (shift.details && Array.isArray(shift.details)) {
        // Find cash payment method details
        const cashDetails = shift.details.find(detail => 
          detail.paymentMethodName && 
          detail.paymentMethodName.toLowerCase().includes('cash')
        );
        
        // Add net payouts from cash method if found (payOuts - payIns)
        if (cashDetails) {
          const cashPayouts = Number.isFinite(cashDetails.payOuts) ? cashDetails.payOuts : 0;
          const cashPayIns = Number.isFinite(cashDetails.payIns) ? cashDetails.payIns : 0;
          shiftCashPayouts = cashPayouts - cashPayIns;
        }
        
        // Calculate total net payouts across all payment methods (payOuts - payIns)
        shiftTotalPayouts = shift.details.reduce((sum, detail) => {
          const detailPayouts = Number.isFinite(detail.payOuts) ? detail.payOuts : 0;
          const detailPayIns = Number.isFinite(detail.payIns) ? detail.payIns : 0;
          return sum + (detailPayouts - detailPayIns);
        }, 0);
      } else if (Number.isFinite(shift.payOuts)) {
        // If we have payOuts at the shift level (and possibly payIns)
        const payOuts = shift.payOuts || 0;
        const payIns = shift.payIns || 0;
        shiftTotalPayouts = payOuts - payIns;
      }
      
      return {
        totalSales: acc.totalSales + (Number.isFinite(shift.sales) ? shift.sales : 0),
        totalRefunds: acc.totalRefunds + (Number.isFinite(shift.refunds) ? shift.refunds : 0),
        totalPayouts: acc.totalPayouts + shiftTotalPayouts,
        totalCashOut: acc.totalCashOut + (Number.isFinite(shift.cashOutAmount) ? shift.cashOutAmount : 0),
        totalCashPayouts: acc.totalCashPayouts + shiftCashPayouts
      };
    }, { 
      totalSales: 0,
      totalRefunds: 0, 
      totalPayouts: 0,
      totalCashOut: 0,
      totalCashPayouts: 0
    });

    // Use API-provided values for some fields, calculated values for others
    return {
      // Use calculated totals that include all shifts
      totalSales: calculatedTotals.totalSales,
      totalRefunds: calculatedTotals.totalRefunds,
      totalPayouts: calculatedTotals.totalPayouts,
      totalCashOut: calculatedTotals.totalCashOut,
      totalCashPayouts: calculatedTotals.totalCashPayouts,
      // Use API provided values for these
      totalDifference: shiftReports.totalDifference || 0,
      totalDuration: shiftReports.totalDuration || '0h 0m',
      // Active shift expected amount
      activeShiftExpected
    };
  }

  // Handle date change
  function handleDateChange(e) {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  }

  // Handle search button click
  function handleSearch() {
    loadShiftReports();
  }

  // Calculate summary if we have shift reports
  const summary = shiftReports ? calculateSummary() : null;

  // Add toggleable row function
  function ShiftRow({ shift, formatDate, formatCurrency, styles, reportType }) {
    return (
      <tr key={shift.shiftId} className={shift.isActive ? styles.activeShift : ''}>
        <td>{shift.shiftId}</td>
        <td>{formatDate(shift.startTime)}</td>
        <td>
          {shift.endTime ? formatDate(shift.endTime) : 
            shift.calculatedEndTime ? (
              <span title="Estimated end time">
                {formatDate(shift.calculatedEndTime)} <em>(est.)</em>
              </span>
            ) : 'In Progress'}
        </td>
        <td>{shift.duration || '0h 0m'}</td>
        <td>{shift.operatorName || 'Unknown'}</td>
        <td>{shift.registerName || 'Unknown'}</td>
        <td>{Number.isFinite(shift.startCash) ? formatCurrency(shift.startCash) : '0 MAD'}</td>
        <td>{Number.isFinite(shift.expected) ? formatCurrency(shift.expected) : '0 MAD'}</td>
        <td>
          {/* Net Payouts (payOuts - payIns) */}
          {Number.isFinite(shift.payOuts) ? 
            formatCurrency((shift.payOuts || 0) - (shift.payIns || 0)) : 
            (shift.details && shift.details.length > 0) 
              ? formatCurrency(shift.details.reduce((sum, d) => {
                  const detailPayouts = Number.isFinite(d.payOuts) ? d.payOuts : 0;
                  const detailPayIns = Number.isFinite(d.payIns) ? d.payIns : 0;
                  return sum + (detailPayouts - detailPayIns);
                }, 0))
              : '0 MAD'
          }
        </td>
        <td>{shift.actual !== null && Number.isFinite(shift.actual) ? formatCurrency(shift.actual) : '-'}</td>
        <td className={`${styles.cashOut} ${shift.cashOutAmount ? styles.hasCashOut : ''}`}>
          {shift.cashOutAmount ? (
            <span title={`End cash from previous shift: ${formatCurrency(shift.prevShiftEndCash)}`}>
              {formatCurrency(shift.cashOutAmount)}
            </span>
          ) : '-'}
        </td>
        <td>{Number.isFinite(shift.sales) ? formatCurrency(shift.sales) : '0 MAD'}</td>
        {reportType === 2 && (
          <td>{Number.isFinite(shift.refunds) ? formatCurrency(shift.refunds) : '0 MAD'}</td>
        )}
        <td className={Number.isFinite(shift.difference) && shift.difference >= 0 ? styles.positive : styles.negative}>
          {Number.isFinite(shift.difference) ? formatCurrency(shift.difference) : '0 MAD'}
        </td>
        <td>
          <span className={`${styles.status} ${!shift.isActive ? styles.statusClosed : styles.statusActive}`}>
            {!shift.isActive ? 'Closed' : 'Active'}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <AdminPageWrapper title="Admin Statistics">
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <FaChartLine className={styles.titleIcon} />
            Admin Statistics
          </h1>
          <p className={styles.subtitle}>View detailed reports and statistics</p>
        </header>

        <section className={styles.reportsSection}>
          <h2 className={styles.sectionTitle}>
            <FaMoneyBillWave className={styles.sectionIcon} />
            Shift Reports
          </h2>

          <div className={styles.controls}>
            <div className={styles.dateControl}>
              <label htmlFor="dateFrom">Start Date</label>
              <div className={styles.dateInputWrapper}>
                <FaCalendarAlt className={styles.dateIcon} />
                <input
                  id="dateFrom"
                  name="dateFrom"
                  type="date"
                  className={styles.dateInput}
                  value={dateRange.dateFrom}
                  onChange={handleDateChange}
                />
              </div>
            </div>

            <div className={styles.dateControl}>
              <label htmlFor="dateTo">End Date</label>
              <div className={styles.dateInputWrapper}>
                <FaCalendarAlt className={styles.dateIcon} />
                <input
                  id="dateTo"
                  name="dateTo"
                  type="date"
                  className={styles.dateInput}
                  value={dateRange.dateTo}
                  onChange={handleDateChange}
                />
              </div>
            </div>
            
            <div className={styles.reportTypeControl}>
              <label htmlFor="reportType">Report Type</label>
              <select
                id="reportType"
                className={styles.reportTypeSelect}
                value={reportType}
                onChange={(e) => setReportType(Number(e.target.value))}
              >
                <option value={1}>Simple</option>
                <option value={2}>Detailed</option>
              </select>
            </div>

            <button 
              className={styles.searchButton} 
              onClick={handleSearch}
              disabled={loading || !dateRange.dateFrom || !dateRange.dateTo}
            >
              {loading ? (
                <>
                  <FaSpinner className={styles.spinner} />
                  Loading...
                </>
              ) : (
                <>
                  <FaSearch />
                  Search
                </>
              )}
            </button>
          </div>

          {error && (
            <div className={styles.errorContainer}>
              <p className={styles.errorMessage}>
                <FaExclamationTriangle /> {error}
              </p>
            </div>
          )}

          {loading && (
            <div className={styles.loadingContainer}>
              <FaSpinner className={styles.spinnerLarge} />
              <p>Loading shift reports...</p>
            </div>
          )}

          {!loading && shiftReports && (
            <div className={styles.reportsContainer}>
              {/* Operator name display section */}
              {shiftReports.operatorName && (
                <div className={styles.operatorInfoHeader}>
                  <div className={styles.operatorBadge}>
                    <FaUser className={styles.operatorIcon} />
                    <span className={styles.operatorName}>{shiftReports.operatorName}</span>
                  </div>
                </div>
              )}

              {/* Summary cards */}
              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaMoneyBillWave />
                  </div>
                  <div>
                    <h3>Total Sales</h3>
                    <p className={styles.amount}>{formatCurrency(summary?.totalSales || 0)}</p>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaCalculator />
                  </div>
                  <div>
                    <h3 title="Expected amount for the current/last active shift">Current Shift Expected</h3>
                    <p className={styles.amount}>{formatCurrency(summary?.activeShiftExpected || 0)}</p>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaWallet />
                  </div>
                  <div>
                    <h3 title={reportType === 2 ? "Total cash payouts (from Cash payment method only)" : "Total cash taken out between shifts (operator payments)"}>
                      Total Payout
                    </h3>
                    <p className={styles.amount}>
                      {reportType === 2 
                        ? formatCurrency(summary?.totalCashPayouts || 0)
                        : formatCurrency(summary?.totalCashOut || 0)
                      }
                    </p>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaHandHoldingUsd />
                  </div>
                  <div>
                    <h3 title="Net payouts (Pay-Outs minus Pay-Ins)">Net Payouts</h3>
                    <p className={styles.amount}>{formatCurrency(summary?.totalPayouts || 0)}</p>
                  </div>
                </div>

                {/* Only show Refunds in detailed report */}
                {reportType === 2 && (
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryIcon}>
                      <FaUndo />
                    </div>
                    <div>
                      <h3>Total Refunds</h3>
                      <p className={styles.amount}>{formatCurrency(summary?.totalRefunds || 0)}</p>
                    </div>
                  </div>
                )}

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaExchangeAlt />
                  </div>
                  <div>
                    <h3>Total Difference</h3>
                    <p className={`${styles.amount} ${(summary?.totalDifference || 0) >= 0 ? styles.positive : styles.negative}`}>
                      {formatCurrency(summary?.totalDifference || 0)}
                    </p>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <FaClock />
                  </div>
                  <div>
                    <h3>Total Duration</h3>
                    <p className={styles.amount}>{summary?.totalDuration || '0h 0m'}</p>
                  </div>
                </div>
              </div>

              {/* Raw data display (for debugging) */}
              {/* No longer needed - API is working properly */}

              {/* Operator info */}
              {shiftReports.operatorName && (
                <div className={styles.operatorInfo}>
                  <h3 className={styles.tableTitle}>
                    <FaUser /> Operator: {shiftReports.operatorName}
                  </h3>
                </div>
              )}

              {/* Shifts table */}
              <h3 className={styles.tableTitle}>Shift Details</h3>
              
              <div className={styles.tableWrapper}>
                <table className={styles.shiftsTable}>
                  <thead>
                    <tr>
                      <th>Shift ID</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Duration</th>
                      <th>Operator</th>
                      <th>Register</th>
                      <th>Start Amount</th>
                      <th>Expected</th>
                      <th title="Net payouts (Pay-Outs minus Pay-Ins)">Net Payouts</th>
                      <th>End Amount</th>
                      <th title="Cash removed between shifts (payment to previous operator)">Cash Out</th>
                      <th>Sales</th>
                      {reportType === 2 && <th>Refunds</th>}
                      <th>Difference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftReports.shifts && shiftReports.shifts.length > 0 ? (
                      shiftReports.shifts.map((shift) => (
                        <ShiftRow 
                          key={shift.shiftId}
                          shift={shift}
                          formatDate={formatDate}
                          formatCurrency={formatCurrency}
                          styles={styles}
                          reportType={reportType}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={reportType === 2 ? 15 : 14} style={{ textAlign: 'center', padding: '2rem' }}>
                          No shift reports found for the selected date range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && !shiftReports && !error && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#e0e0e0' }}>
              Select a date range and click Search to view shift reports
            </div>
          )}
        </section>
      </div>
    </AdminPageWrapper>
  );
} 