import { useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Shield, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import type { WalletTransaction } from '../lib/supabase';

type WalletLike = { balance: number } | null;

type Props = {
  wallet: WalletLike;
  transactions: WalletTransaction[];
  totalEscrow: number;
  onDeposit: (amount: number) => Promise<{ error: string | null | unknown }>;
  onBack: () => void;
};

export function WalletPage({ wallet, transactions, totalEscrow, onDeposit, onBack }: Props) {
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const balance = wallet?.balance ?? 0;

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) { setDepositError('Enter a valid amount'); return; }
    setDepositing(true); setDepositError(null);
    const result = await onDeposit(amount);
    setDepositing(false);
    if (result.error) { setDepositError(String(result.error)); }
    else { setDepositAmount(''); setSuccess(true); setTimeout(() => setSuccess(false), 2000); }
  };

  const typeIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'deposit': return <TrendingUp className="w-3.5 h-3.5 text-brand-500" />;
      case 'escrow_hold': return <Shield className="w-3.5 h-3.5 text-amber-500" />;
      case 'escrow_release': return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
      case 'earning': return <TrendingUp className="w-3.5 h-3.5 text-brand-500" />;
      case 'refund': return <TrendingDown className="w-3.5 h-3.5 text-cyan-500" />;
      case 'withdrawal': return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  const typeLabel: Record<WalletTransaction['type'], string> = {
    deposit: 'Deposit', escrow_hold: 'Escrow Held', escrow_release: 'Escrow Released',
    refund: 'Refund', withdrawal: 'Withdrawal', earning: 'Earning',
  };

  // Positive amounts shown with +, escrow_release is neutral (no prefix), others are -
  const isPositiveType = (type: WalletTransaction['type']) => type === 'deposit' || type === 'earning' || type === 'refund';
  const isNeutralType = (type: WalletTransaction['type']) => type === 'escrow_release';

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"><ArrowLeft className="w-4 h-4 text-gray-400" /></button>
          <div><h2 className="text-sm font-bold text-gray-900 dark:text-white">Wallet</h2><p className="text-[10px] text-gray-400">Balance & transactions</p></div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center"><DollarSign className="w-5 h-5 text-white" /></div>
              <div><p className="text-xs text-gray-400">Available Balance</p><p className="text-2xl font-bold text-gray-900 dark:text-white">${balance.toFixed(2)}</p></div>
            </div>
            {totalEscrow > 0 && (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-amber-500" /><span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Escrow: ${totalEscrow.toFixed(2)}</span></div>
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Add Funds (Simulated)</label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                  <input type="number" value={depositAmount} onChange={(e) => { setDepositAmount(e.target.value); setDepositError(null); }} placeholder="0.00" min="0" step="0.01"
                    className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all" />
                </div>
                <button onClick={handleDeposit} disabled={depositing || !depositAmount}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white disabled:text-gray-400 text-sm font-medium transition-all">
                  {depositing ? 'Adding...' : success ? 'Added!' : 'Add'}
                </button>
              </div>
              {depositError && <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-500"><AlertCircle className="w-3 h-3" />{depositError}</div>}
              <div className="flex gap-1.5 mt-2">
                {[10, 25, 50, 100, 250].map((amt) => (
                  <button key={amt} onClick={() => setDepositAmount(String(amt))} className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-700 hover:bg-brand-50 dark:hover:bg-brand-500/10 border border-gray-200 dark:border-gray-600 rounded text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">${amt}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Transactions</h3>
            {transactions.length === 0 ? (
              <div className="text-center py-6"><Clock className="w-6 h-6 text-gray-200 dark:text-gray-700 mx-auto mb-1.5" /><p className="text-xs text-gray-400">No transactions yet</p></div>
            ) : (
              <div className="space-y-1.5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-lg">
                    <div className="w-7 h-7 bg-gray-50 dark:bg-gray-700 rounded-md flex items-center justify-center flex-shrink-0">{typeIcon(tx.type)}</div>
                    <div className="flex-1 min-w-0"><p className="text-xs text-gray-900 dark:text-white font-medium">{typeLabel[tx.type]}</p><p className="text-[10px] text-gray-400 truncate">{tx.description}</p></div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold ${isPositiveType(tx.type) ? 'text-brand-600 dark:text-brand-400' : isNeutralType(tx.type) ? 'text-gray-500 dark:text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isPositiveType(tx.type) ? '+' : isNeutralType(tx.type) ? '' : '-'}${tx.amount.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-300 dark:text-gray-600">{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
