import { DealershipDetail } from '@/components/admin/DealershipDetail';

interface DealershipDetailPageProps {
  params: {
    id: string;
  };
}

export default function DealershipDetailPage({ params }: DealershipDetailPageProps) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 pb-20 pt-10 md:px-8 md:pt-14">
      <div>
        <a href="/admin" className="text-[14px] text-tinta-2 hover:text-tinta">← Panel</a>
        <DealershipDetail dealershipId={params.id} />
      </div>
    </div>
  );
}
