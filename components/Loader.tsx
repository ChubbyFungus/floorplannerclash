import React from 'react';

interface LoaderProps {
  message?: string;
  summary?: string | null;
  finalPrompt?: string | null;
}

const Loader: React.FC<LoaderProps> = ({ message = "Generating your 3D floor plan...", summary, finalPrompt }) => {
  return (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex flex-col justify-center items-center z-50 backdrop-blur-sm p-8">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
      <p className="mt-4 text-lg text-gray-200 font-semibold">{message}</p>
      
      {(summary || finalPrompt) && (
        <div className="mt-6 w-full max-w-2xl bg-gray-800 rounded-lg p-4 text-left overflow-y-auto max-h-96 shadow-lg border border-gray-700">
          {summary && (
            <div>
              <h3 className="text-md font-bold text-blue-400 mb-2">Design Summary:</h3>
              <div className="text-gray-300 text-sm whitespace-pre-wrap">
                {summary}
              </div>
            </div>
          )}
          {finalPrompt && (
            <div className={summary ? 'mt-4 pt-4 border-t border-gray-700' : ''}>
              <h3 className="text-md font-bold text-gray-500 mb-2">Dev Info: Final Prompt</h3>
              <p className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-900 p-2 rounded">
                {finalPrompt}
              </p>
            </div>
          )}
        </div>
      )}
      
      <p className="text-sm text-gray-400 mt-4">This may take a moment.</p>
    </div>
  );
};

export default Loader;