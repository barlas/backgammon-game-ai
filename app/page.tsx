import BackgammonBoard from './components/BackgammonBoard';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          Backgammon Game
        </h1>
        <BackgammonBoard />
      </main>
    </div>
  );
}
