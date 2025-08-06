import ClientSideAutoFlipClean from '@/components/client-side-autoflip-clean';

export default function ClientSideAutoFlipPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Client-Side AutoFlip
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Process videos entirely in your browser with intelligent focus detection and cropping
          </p>
        </div>
        
        <ClientSideAutoFlipClean />
      </div>
    </div>
  );
}