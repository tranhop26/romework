'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ShieldCheck, Wallet } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import styles from './workroom.module.css';

const primary = 'bg-blue-700 text-white hover:bg-blue-800';
const secondary = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
const actionButton = buttonVariants({size:'lg',className:primary});
const terms = 'RomeWork G0: test tokens only; no refund, dispute or admin; accept then fund, submit, approve, claim and explicit ATA sweep.';
const milestones = [
  { stage:'accept', role:'Freelancer · Solana', title:'Chấp thuận điều khoản', description:'Dùng ví freelancer đã gắn với escrow để xác nhận mốc này.', button:'Xem giao dịch chấp thuận' },
  { stage:'delivery', role:'Freelancer · Solana', title:'Gửi bàn giao', description:'Ghi bằng chứng bàn giao thử nghiệm lên escrow.', button:'Xem giao dịch bàn giao' },
  { stage:'approve', role:'Client · MetaMask', title:'Duyệt bàn giao', description:'Duyệt để mở quyền nhận USDC cho freelancer.', button:'Xem giao dịch duyệt' },
  { stage:'claim', role:'Freelancer · Solana', title:'Nhận tiền từ escrow', description:'Nhận USDC vào tài khoản Rome của freelancer.', button:'Xem giao dịch nhận tiền' },
  { stage:'sweep', role:'Freelancer · Solana', title:'Chuyển USDC về ví Solana', description:'Chuyển số USDC đã nhận về tài khoản token của ví Solana.', button:'Xem giao dịch chuyển về ví' },
] as const;

export function HadrianWorkroom() {
  const root=useRef<HTMLFieldSetElement>(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    let unmount:(()=>void)|undefined;
    import('@/lib/rome/mount-workroom').then(({mountRomeWorkroom})=>{
      if(!active||!root.current)return;
      unmount=mountRomeWorkroom(root.current);
      setReady(true);
    }).catch((cause:unknown)=>{
      if(active)setError(cause instanceof Error?cause.message:String(cause));
    });
    return()=>{active=false;unmount?.();};
  },[]);

  return (
    <div className={styles.workroom}>
      {!ready && <p className="mb-3 text-sm text-slate-600" role="status">{error || 'Đang mở workroom…'}</p>}
      <fieldset ref={root} disabled={!ready} className="min-w-0 space-y-4">
        <legend className="sr-only">RomeWork Hadrian</legend>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="wallets-heading">
          <h2 id="wallets-heading" className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Wallet className="size-4 text-blue-700" aria-hidden="true" /> Ví tham gia</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold">Client <span className="font-normal text-slate-500">· MetaMask</span></p>
              <p id="client-display" className="break-all font-mono text-xs text-slate-600">Chưa kết nối</p>
              <Button id="evm-connect" type="button" variant="outline" className={secondary}>Kết nối MetaMask</Button>
            </div>
            <div className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold">Freelancer <span className="font-normal text-slate-500">· Solana Devnet</span></p>
              <p id="freelancer-display" className="break-all font-mono text-xs text-slate-600">Chưa kết nối</p>
              <div className="flex flex-wrap gap-2">
                <Button id="sol-metamask-connect" type="button" variant="outline" className={secondary}>Kết nối MetaMask Solana</Button>
                <Button id="sol-connect" type="button" variant="outline" className={secondary}>Kết nối OKX Wallet</Button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button id="wallet-balances" type="button" variant="ghost" className="text-blue-700">Đọc số dư testnet</Button>
            <p id="balance-summary" className="whitespace-pre-line text-xs text-slate-600" aria-live="polite" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="Bước hiện tại">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <p id="workroom-status" className="text-sm font-semibold text-blue-800" aria-live="polite">Đang đọc trạng thái</p>
            <Button id="refresh" type="button" variant="outline" className={secondary}>Đọc trạng thái</Button>
          </div>
          <ol id="workroom-steps" className={styles.steps} aria-label="Tiến độ ký quỹ" />
          <div className="mt-5 space-y-3">
            <div data-stage="read" hidden><h2 className="text-lg font-bold">Mở lượt ký quỹ đã lưu</h2><p className="mt-1 text-sm text-slate-600">Bấm đọc trạng thái để lấy bước tiếp theo từ Hadrian.</p></div>
            <div data-stage="recover" hidden><h2 className="text-lg font-bold">Đối chiếu giao dịch đang chờ</h2><p className="mt-1 text-sm text-slate-600">Bấm đọc trạng thái để kiểm tra giao dịch cũ. Khi kết quả đã rõ, RomeWork sẽ hiện bước tiếp theo.</p></div>
            <div data-stage="deploy" hidden>
              <h2 className="text-lg font-bold">Tạo escrow thử nghiệm</h2>
              <p className="mt-1 text-sm text-slate-600">Kết nối hai ví rồi xem trước phí deploy. Mỗi escrow có một mốc và dùng tối đa 1 test USDC.</p>
              <button id="deploy" type="button" className={`mt-3 ${actionButton}`}>Chuẩn bị deploy bằng MetaMask <ArrowRight /></button>
            </div>
            <div data-stage="fund" hidden>
              <p className="text-xs font-semibold text-blue-700">Client · MetaMask</p>
              <h2 className="mt-1 text-lg font-bold">Nạp tiền ký quỹ</h2>
              <p id="fund-hint" className="my-3 text-sm text-slate-600" aria-live="polite">Đang kiểm tra điều kiện ký quỹ…</p>
              <div data-fund-step="wrap" hidden><Button data-action="wrap" type="button">Xem giao dịch wrap test USDC</Button></div>
              <div data-fund-step="grant" hidden><Button data-action="grant" type="button">Xem giao dịch cấp quyền wrapper</Button></div>
              <div data-fund-step="allowance" hidden><Button data-action="allowance" type="button">Xem giao dịch đặt giới hạn chi</Button></div>
              <div data-fund-step="baseline" hidden><Button id="snapshot" type="button">Lưu số dư gốc</Button></div>
              <div data-fund-step="fund" hidden><button data-action="fund" type="button" className={actionButton}>Xem giao dịch ký quỹ <ArrowRight /></button></div>
            </div>
            {milestones.map(({stage,role,title,description,button})=>(
              <div key={stage} data-stage={stage} hidden>
                <p className="text-xs font-semibold text-blue-700">{role}</p>
                <h2 className="mt-1 text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
                {stage==='sweep' && <details className="mt-3 rounded-lg border border-slate-200 px-3">
                  <summary className="cursor-pointer py-2 text-sm font-medium">Chuẩn bị tài khoản nhận nếu thiếu</summary>
                  <div className="flex flex-wrap gap-2 pb-3">
                    <Button data-action="provision" type="button" variant="outline">Tạo tài khoản Rome</Button>
                    <Button data-action="ata" type="button" variant="outline">Tạo tài khoản USDC trên Solana</Button>
                  </div>
                </details>}
                <button type="button" data-action={stage} className={`mt-3 ${actionButton}`}>{button} <ArrowRight /></button>
              </div>
            ))}
            <div data-stage="reconcile" hidden><h2 className="text-lg font-bold">Đã chuyển về ví Solana</h2><p className="mt-1 text-sm text-slate-600">Mở phần kỹ thuật để kiểm tra số dư và tải bằng chứng.</p></div>
          </div>
        </section>

        <section id="preview-section" hidden className="scroll-mt-24 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="size-4 text-blue-700" aria-hidden="true" /> Xem trước khi ký</h2>
          <p id="preview-summary" className="my-2 whitespace-pre-line text-sm text-slate-700" aria-live="polite" />
          <details className="my-3 text-sm"><summary className="cursor-pointer">Chi tiết giao dịch</summary><pre id="preview">Chưa có giao dịch được chuẩn bị.</pre></details>
          <div className="flex flex-wrap gap-2">
            <button id="review-action-fee" type="button" hidden className={actionButton}>Duyệt trần phí cho lượt này</button>
            <button id="send" type="button" disabled className={actionButton}>Mở ví để tự xem và ký</button>
          </div>
        </section>

        <pre id="log" role="status" aria-live="polite" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-900 empty:hidden" />

        <details className="rounded-xl border border-slate-200 bg-white px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-semibold text-slate-700">Cài đặt và chi tiết kỹ thuật <ChevronDown className="size-4" aria-hidden="true" /></summary>
          <div className="space-y-4 border-t border-slate-100 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">Địa chỉ Client<Input id="client" placeholder="Kết nối MetaMask để điền" /></label>
              <label className="space-y-1 text-sm">Public key Freelancer<Input id="sol-key" placeholder="Kết nối ví Solana Devnet để điền" /></label>
              <label className="space-y-1 text-sm">Số tiền thử nghiệm<Input id="amount" defaultValue="0.1" inputMode="decimal" /></label>
              <label className="space-y-1 text-sm">Điều khoản thử nghiệm<Input id="terms" defaultValue={terms} /></label>
              <label className="space-y-1 text-sm">Địa chỉ escrow<Input id="contract" placeholder="Địa chỉ escrow đã deploy" /></label>
              <label className="space-y-1 text-sm">Hash phục hồi<Input id="recovery-hash" placeholder="Hash từ MetaMask Activity" /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button id="preflight" type="button" variant="outline">Kiểm tra RPC chỉ đọc</Button>
              <Button id="load" type="button" variant="outline">Kiểm tra deployment</Button>
              <Button data-action="provision" type="button" variant="outline">Tạo tài khoản Rome nếu thiếu</Button>
              <Button data-action="ata" type="button" variant="outline">Tạo tài khoản USDC Solana nếu thiếu</Button>
              <Button id="negative" type="button" variant="outline">Mô phỏng sai quyền</Button>
              <Button id="attach-hash" type="button" variant="outline">Đối chiếu hash</Button>
              <Button id="export" type="button" variant="outline">Tải run bundle</Button>
              <Button id="manifest" type="button" variant="outline">Tải manifest</Button>
              <Button id="new-run" type="button" variant="outline">Lượt mới sau sweep</Button>
            </div>
            <p className="text-xs text-slate-600">Giá trị mốc <strong id="budget-value">0.10</strong> · Đang khóa <strong id="locked-value">—</strong> · Chờ claim <strong id="claimable-value">—</strong> · Đã rời escrow <strong id="paid-value">—</strong></p>
            <pre id="wallet-status">Chưa kết nối ví.</pre><pre id="balances">Chưa đọc số dư.</pre><pre id="environment">Chưa kiểm tra môi trường.</pre>
            <pre id="identity">Chưa có deployment.</pre><pre id="state">Chưa có dữ liệu.</pre><pre id="journal">[]</pre>
          </div>
        </details>
      </fieldset>
    </div>
  );
}
