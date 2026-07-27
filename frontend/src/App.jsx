import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './common/routes';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Provider store={store}>
      <Toaster
        position="top-center"
        containerStyle={{
          top: 84,
        }}
        containerClassName="lg:pl-[280px] transition-all duration-300"
        reverseOrder={false}
        toastOptions={{
          className: 'text-[14px] font-semibold font-["Plus_Jakarta_Sans"]',
          style: {
            borderRadius: '16px',
            background: '#073318',
            color: '#fff',
            padding: '16px 24px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            border: '1px solid #062a14',
          },
          duration: 4000,
          success: {
            iconTheme: {
              primary: '#fff',
              secondary: '#073318',
            },
          },
          error: {
            style: {
              background: '#fff',
              color: '#dc2626',
              border: '1px solid #fee2e2',
            },
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fff',
            },
          },
        }}
      />
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#F8FAF0]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B3D2E]"></div>
        </div>
      }>
        <RouterProvider router={router} />
      </Suspense>
    </Provider>
  );
}

export default App;
