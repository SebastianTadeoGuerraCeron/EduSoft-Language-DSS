import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { API_URL } from '../../../API';
import { HeaderGame } from '../../../components/HeaderGame';
import { useAuth } from '../../../context/AuthContext';
import { SENTENCES_STACK_FOR_VOCABULARY } from '../CONST_VALUES';
import { getRandomElements } from '../../../utils/gameRandomization';

const TOTAL_QUESTIONS = 5;
const POINTS_PER_QUESTION = 100 / TOTAL_QUESTIONS; // Cada pregunta vale 20 puntos

// Función para barajar un arreglo y tomar los primeros N elementos.
// Usando utility function documentada para aleatorización no-crítica en juegos
const shuffleAndPick = (arr, num) => {
	return getRandomElements(arr, num);
};

// Componente para la pantalla de juego
const GameScreen = ({ onGameOver }) => {
	const [gameWords, setGameWords] = useState([]);
	const [currentWord, setCurrentWord] = useState({ definition: '', answer: '' });
	const [userInput, setUserInput] = useState('');
	const [statusMessage, setStatusMessage] = useState('Type the correct word!');
	const [score, setScore] = useState(0);
	const [questionsAsked, setQuestionsAsked] = useState(0);
	const [isRoundComplete, setIsRoundComplete] = useState(false);
	const [results, setResults] = useState([]);

	useEffect(() => {
		setGameWords(shuffleAndPick(SENTENCES_STACK_FOR_VOCABULARY, TOTAL_QUESTIONS));
	}, []);

	useEffect(() => {
		if (gameWords.length > 0 && questionsAsked < gameWords.length) {
			setCurrentWord(gameWords[questionsAsked]);
			setStatusMessage('Type the correct word!');
			setUserInput('');
			setIsRoundComplete(false);
		}
	}, [questionsAsked, gameWords]);

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!userInput.trim() || isRoundComplete) return;

		const isCorrect = userInput.trim().toLowerCase() === currentWord.answer.toLowerCase();

		setResults((prev) => [
			...prev,
			{
				question: currentWord.definition,
				userAnswer: userInput.trim(),
				correctAnswer: currentWord.answer,
				isCorrect: isCorrect,
			},
		]);

		if (isCorrect) {
			// CAMBIO AQUÍ: Se suman los puntos por pregunta en lugar de 1
			setScore((prev) => prev + POINTS_PER_QUESTION);
			setStatusMessage('<p class="text-2xl font-bold text-green-500">Correct!</p>');
		} else {
			setStatusMessage(`
                <p class="text-red-500">Not quite!</p>
                <p class="text-gray-700">The correct answer was: <strong class="font-bold text-blue-600">${currentWord.answer}</strong></p>
            `);
		}
		setIsRoundComplete(true);
	};

	const handleNextClick = () => {
		if (questionsAsked + 1 >= TOTAL_QUESTIONS) {
			onGameOver(results);
		} else {
			setQuestionsAsked((prev) => prev + 1);
		}
	};

	return (
		<div className='max-w-2xl mx-auto p-4 sm:p-6 space-y-6 select-none'>
			<HeaderGame
				typeGame={'Vocabulary'}
				title={'Vocabulary Challenge'}
				currentStep={questionsAsked + 1}
				totalSteps={TOTAL_QUESTIONS}
				score={score}
			/>

			<div className='my-8 flex flex-col items-center'>
				<p className='text-xl sm:text-2xl text-gray-800 mb-4 bg-gray-100 p-6 rounded-lg min-h-[100px] flex items-center justify-center'
					tabIndex={0}>
					"{currentWord.definition}"
				</p>
			</div>
			<form
				onSubmit={handleSubmit}
				className='flex flex-col sm:flex-row gap-4 justify-center items-center mb-8'
			>
				<input
					type='text'
					value={userInput}
					onChange={(e) => setUserInput(e.target.value)}
					disabled={isRoundComplete}
					className='flex-grow p-4 border-2 border-gray-300 rounded-lg text-xl text-center shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200'
					placeholder='Type the word...'
				/>
				<button
					type='submit'
					disabled={isRoundComplete || !userInput.trim()}
					className='bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-md disabled:bg-green-300 disabled:cursor-not-allowed'
					tabIndex={0}
				>
					Submit
				</button>
			</form>
			<div className='h-16 flex flex-col items-center justify-center p-4 rounded-lg bg-gray-100'>
				<div dangerouslySetInnerHTML={{ __html: statusMessage }}
					tabIndex={0} />
			</div>
			{isRoundComplete && (
				<button
					onClick={handleNextClick}
					className='mt-4 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg'
				>
					Next ➔
				</button>
			)}
		</div>
	);
};

// Componente para la pantalla de fin de juego
const GameOverScreen = ({ results, onPlayAgain }) => {
	const correctAnswers = results.filter((r) => r.isCorrect);
	const incorrectAnswers = results.filter((r) => !r.isCorrect);
	const accuracy =
		results.length > 0 ? Math.round((correctAnswers.length / results.length) * 100) : 0;

	// Calcula el puntaje final para mostrarlo en el resumen
	const finalScore = correctAnswers.length * POINTS_PER_QUESTION;

	const getPerformanceLevel = (score) => {
		if (score >= 90)
			return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
		if (score >= 75) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
		if (score >= 60)
			return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
		return { level: 'Needs Practice', color: 'text-gray-600', bg: 'bg-gray-100' };
	};

	const performance = getPerformanceLevel(finalScore);

	return (
		<div className='w-full max-w-4xl mx-auto my-16 bg-white shadow-2xl rounded-2xl p-4 sm:p-8 md:p-12 text-left'>
			<h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center'
				tabIndex={0}>
				Challenge Complete!
			</h1>

			{/* Resumen de puntaje principal */}
			<div className='text-center mb-8'>
				{/* Etiqueta para el puntaje */}
				<div className='text-lg font-medium text-gray-600 mb-1'
					tabIndex={0}>Score</div>

				{/* Resultado del puntaje */}
				<div className='text-4xl sm:text-5xl font-bold text-blue-600 mb-2'
					tabIndex={0}>
					{finalScore}
				</div>

				{/* Nivel de rendimiento */}
				<div
					className={`inline-block px-4 py-2 rounded-full font-semibold ${performance.bg} ${performance.color}`}
					tabIndex={0}
				>
					{performance.level}
				</div>
			</div>

			{/* Estadísticas detalladas */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800'
						tabIndex={0}>
						{correctAnswers.length}/{results.length}
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Correct Definitions</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>{accuracy}%</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Accuracy Rate</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>{results.length}</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Total Words</div>
				</div>
			</div>

			<p className='text-gray-600 text-center mb-8 sm:mb-10'
				tabIndex={0}>
				Let's review your vocabulary performance. Use this feedback to expand your word
				knowledge.
			</p>

			<div className='space-y-8'>
				{/* Sección de respuestas correctas */}
				{correctAnswers.length > 0 && (
					<section>
						<h2 className='text-xl sm:text-2xl font-bold text-green-700 mb-4 flex items-center'
							tabIndex={0}>
							<span className='bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✓
							</span>
							Correct Definitions ({correctAnswers.length})
						</h2>
						<div className='space-y-3'>
							{correctAnswers.map((r, i) => (
								<div
									key={i}
									className='p-4 bg-green-50 border border-green-200 rounded-lg'
								>
									<div className='flex items-start gap-3'>
										<div className='flex-shrink-0 bg-green-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-1' tabIndex={0}>"{r.question}"</p>
											<p className='text-sm text-gray-600' tabIndex={0}>
												Your answer:{' '}
												<span className='font-medium text-green-700' tabIndex={0}>{r.userAnswer}</span>
											</p>
											<p className='text-sm text-gray-600' tabIndex={0}>
												Correct answer:{' '}
												<span className='font-medium text-green-700' tabIndex={0}>
													{r.correctAnswer}
												</span>
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Sección de respuestas incorrectas */}
				{incorrectAnswers.length > 0 && (
					<section>
						<h2 className='text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center' tabIndex={0}>
							<span className='bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✗
							</span>
							Areas for Improvement ({incorrectAnswers.length})
						</h2>
						<div className='space-y-3'>
							{incorrectAnswers.map((r, i) => (
								<div key={i} className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
									<div className='flex items-start gap-3'>
										<div className='flex-shrink-0 bg-gray-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-1' tabIndex={0}>"{r.question}"</p>
											<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
												Correct answer:{' '}
												<span className='font-medium text-blue-700' tabIndex={0}>
													{r.correctAnswer}
												</span>
											</p>
											<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
												Your answer:{' '}
												<span className='font-medium text-blue-700' tabIndex={0}>
													{r.userAnswer || 'No answer provided'}
												</span>
											</p>
											<p className='text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300'
												tabIndex={0}>
												Tip: Try to understand the context and meaning of the
												definition. Look for key words that might help you identify the
												correct term.
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				)}
			</div>

			{/* Mensaje motivacional basado en el rendimiento */}
			<div className={`mt-8 p-4 rounded-lg ${performance.bg} border border-opacity-30`}>
				<div className={`text-center ${performance.color} font-semibold`}
					tabIndex={0}>
					{finalScore >= 90 &&
						'Outstanding! Your vocabulary knowledge is excellent. Keep up the great work!'}
					{finalScore >= 75 &&
						finalScore < 90 &&
						"👏 Good job! You're showing strong vocabulary skills. A little more practice and you'll be perfect!"}
					{finalScore >= 60 &&
						finalScore < 75 &&
						"💪 You're making progress! Focus on learning new words and their definitions to improve your results."}
					{finalScore < 60 &&
						'Keep practicing! Vocabulary takes time to build. Review the feedback and try again.'}
				</div>
			</div>

			<div className='mt-10 sm:mt-12 flex flex-col sm:flex-row gap-4 justify-center'>
				<button
					onClick={onPlayAgain}
					className='bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg cursor-pointer'
				>
					Play Again
				</button>
				<Link
					to='/games'
					className='bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg text-center cursor-pointer'
				>
					Browse Other Games
				</Link>
			</div>
		</div>
	);
};

//Componente principal renombrado a 'Vocabulary'
export const Vocabulary = () => {
	// El estado del juego ahora comienza en 'playing'
	const [gameState, setGameState] = useState('playing');
	const [gameResults, setGameResults] = useState([]);
	const { user } = useAuth();

	const handleGameOver = async (results) => {
		setGameResults(results);
		setGameState('over');

		const correct = results.filter((r) => r.isCorrect).length;
		const score = Math.round((correct / TOTAL_QUESTIONS) * 100);

		if (user && user.id) {
			try {
				await fetch(`${API_URL}/user/game-history`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						userId: user.id,
						game: 'Vocabulary Challenge',
						score: score,
					}),
				});
			} catch (e) {
				console.warn('No se pudo guardar el puntaje de vocabulary:', e);
			}
		}
	};

	const handlePlayAgain = () => {
		// Al jugar de nuevo, reiniciamos el estado a 'playing'
		setGameResults([]);
		setGameState('playing');
	};

	const renderGameState = () => {
		switch (gameState) {
			case 'playing':
				return <GameScreen onGameOver={handleGameOver} />;
			case 'over':
				return <GameOverScreen results={gameResults} onPlayAgain={handlePlayAgain} />;
			default:
				return <GameScreen onGameOver={handleGameOver} />;
		}
	};

	return (
		<div className='w-full flex-grow flex items-center justify-center p-4'>
			{renderGameState()}
		</div>
	);
};

export default Vocabulary;
