import React from 'react';

interface AdBannerProps {
  type?: 'banner' | 'rectangle';
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ type = 'banner', className = '' }) => {
  return (
    <div className={`relative bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center overflow-hidden rounded-xl ${
        type === 'rectangle' ? 'w-full aspect-square max-w-[300px] mx-auto' : 'w-full h-24 max-w-4xl mx-auto'
    } ${className}`}>
      <span className="absolute top-1 right-2 text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Advertisement</span>
      <div className="text-center opacity-50">
        <p className="text-zinc-400 font-bold tracking-widest text-lg">GOOGLE ADS</p>
        <p className="text-xs text-zinc-500">AdSense Placeholder</p>
      </div>
      {/* 
        To implement real AdSense, you would drop your <ins> tag here, e.g.:
        <ins className="adsbygoogle"
             style={{ display: 'block' }}
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        And call (window.adsbygoogle = window.adsbygoogle || []).push({});
        in a useEffect.
      */}
    </div>
  );
};

export default AdBanner;
