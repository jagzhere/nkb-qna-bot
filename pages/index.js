import { useState, useEffect } from 'react';
import QnABot from '../components/QnABot';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Devotees' Stories and Experiences
          </h1>
          <p className="text-xl text-gray-600">You AREN'T Alone</p>
        </header>
        
        <QnABot />
      </div>
    </div>
  );
}
