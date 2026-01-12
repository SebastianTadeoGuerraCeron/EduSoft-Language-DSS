import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { API_URL } from '../../../API';
import { HeaderGame } from '../../../components/HeaderGame';
import { SENTENCES_STACK_FOR_LISTENING } from '../CONST_VALUES';
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
	const [gameSentences, setGameSentences] = useState([]);
	const [currentSentence, setCurrentSentence] = useState({
		display: '',
		speak: '',
		answer: '',
	});
	const [userInput, setUserInput] = useState('');
	const [statusMessage, setStatusMessage] = useState('Type the missing word!');
	const [score, setScore] = useState(0);
	const [questionsAsked, setQuestionsAsked] = useState(0);
	const [isRoundComplete, setIsRoundComplete] = useState(false);
	//Estado para guardar los resultados de cada ronda.
	const [results, setResults] = useState([]);

	// Audio control states
	const [volume, setVolume] = useState(0.8); // Default volume at 80%
	const [speechRate, setSpeechRate] = useState(0.8); // Speech rate control
	const [isPaused, setIsPaused] = useState(false);
	const [currentUtterance, setCurrentUtterance] = useState(null);
	const [showAudioControls, setShowAudioControls] = useState(false);
	const [isSpeaking, setIsSpeaking] = useState(false);

	const utteranceRef = useRef(null);

	useEffect(() => {
		setGameSentences(shuffleAndPick(SENTENCES_STACK_FOR_LISTENING, TOTAL_QUESTIONS));
	}, []);

	useEffect(() => {
		if (gameSentences.length > 0 && questionsAsked < gameSentences.length) {
			setCurrentSentence(gameSentences[questionsAsked]);
			setStatusMessage('Type the missing word!');
			setUserInput('');
			setIsRoundComplete(false);
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);

			// Cancel any ongoing speech synthesis
			if (window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}
		}
	}, [questionsAsked, gameSentences]);

	// Cleanup effect for audio
	useEffect(() => {
		return () => {
			if (window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}
		};
	}, []);

	// Audio control functions
	const handlePauseResume = useCallback(() => {
		if (window.speechSynthesis.speaking && !isPaused) {
			window.speechSynthesis.pause();
			setIsPaused(true);
		} else if (isPaused) {
			window.speechSynthesis.resume();
			setIsPaused(false);
		}
	}, [isPaused]);

	const handleStop = useCallback(() => {
		if (window.speechSynthesis.speaking || currentUtterance) {
			window.speechSynthesis.cancel();
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);
		}
	}, [currentUtterance]);

	const handleVolumeChange = useCallback((newVolume) => {
		setVolume(newVolume);
	}, []);

	const handleSpeedChange = useCallback((newRate) => {
		setSpeechRate(newRate);
	}, []);

	const handleListenClick = useCallback(() => {
		if (!currentSentence.speak) return;

		// Cancel any existing speech
		if (window.speechSynthesis.speaking) {
			window.speechSynthesis.cancel();
		}

		setIsSpeaking(true);
		setIsPaused(false);

		const utterance = new SpeechSynthesisUtterance(currentSentence.speak);
		utterance.lang = 'en-US';
		utterance.rate = speechRate;
		utterance.volume = volume;

		utterance.onend = () => {
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);
		};

		utterance.onerror = (event) => {
			console.error('Speech Synthesis Error:', event.error);
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);
		};

		setCurrentUtterance(utterance);
		utteranceRef.current = utterance;
		window.speechSynthesis.speak(utterance);
	}, [currentSentence.speak, speechRate, volume]);

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!userInput.trim() || isRoundComplete) return;

		const isCorrect =
			userInput.trim().toLowerCase() === currentSentence.answer.toLowerCase();

		// Guardar el resultado de la ronda
		setResults((prev) => [
			...prev,
			{
				question: currentSentence.display,
				userAnswer: userInput.trim(),
				correctAnswer: currentSentence.answer,
				isCorrect: isCorrect,
			},
		]);

		if (isCorrect) {
			// Se suman los puntos por pregunta
			setScore((prev) => prev + POINTS_PER_QUESTION);
			setStatusMessage('<p class="text-2xl font-bold text-green-500">Correct!</p>');
		} else {
			setStatusMessage(`
                <p class="text-red-500">Not quite!</p>
                <p class="text-gray-700">The correct answer was: <strong class="font-bold text-blue-600">${currentSentence.answer}</strong></p>
            `);
		}
		setIsRoundComplete(true);
	};

	const handleNextClick = () => {
		// Pasa los resultados al terminar.
		if (questionsAsked + 1 >= TOTAL_QUESTIONS) {
			onGameOver(results);
		} else {
			setQuestionsAsked((prev) => prev + 1);
		}
	};

	return (
		<div className='max-w-2xl mx-auto p-4 sm:p-6 space-y-6 select-none'>
			{/* Custom CSS for better slider styling */}
			<style jsx>{`
				.slider::-webkit-slider-thumb {
					appearance: none;
					height: 20px;
					width: 20px;
					border-radius: 50%;
					background: #3b82f6;
					cursor: pointer;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
					transition: all 0.2s ease;
				}
				.slider::-webkit-slider-thumb:hover {
					background: #2563eb;
					transform: scale(1.1);
				}
				.slider::-webkit-slider-track {
					height: 8px;
					border-radius: 4px;
					background: #e5e7eb;
				}
				.slider::-moz-range-thumb {
					height: 20px;
					width: 20px;
					border-radius: 50%;
					background: #3b82f6;
					cursor: pointer;
					border: none;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
				}
				.slider::-moz-range-track {
					height: 8px;
					border-radius: 4px;
					background: #e5e7eb;
				}
			`}</style>

			<HeaderGame
				typeGame='Listen'
				title='Listening Challenge'
				currentStep={questionsAsked + 1}
				totalSteps={TOTAL_QUESTIONS}
				score={score}
			/>

			<div className='my-8 flex flex-col items-center'>
				<p className='text-2xl sm:text-3xl text-gray-800 mb-4 bg-gray-100 p-4 rounded-lg'
					tabIndex={0}>
					{currentSentence.display}
				</p>

				{/* Audio Controls - Compact and Collapsible */}
				<div className='mb-6 w-full max-w-md'>
					{/* Audio Control Toggle Button */}
					<button
						onClick={() => setShowAudioControls(!showAudioControls)}
						className='w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-150 rounded-lg border border-gray-200 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400'
						aria-expanded={showAudioControls}
						aria-controls='audio-controls-panel'
					>
						<span className='text-sm font-medium text-gray-700'>🎛️ Audio Settings</span>
						<svg
							className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showAudioControls ? 'rotate-180' : ''
								}`}
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M19 9l-7 7-7-7'
							/>
						</svg>
					</button>

					{/* Collapsible Audio Controls Panel */}
					<div
						id='audio-controls-panel'
						className={`transition-all duration-300 ease-in-out overflow-hidden ${showAudioControls ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
							}`}
					>
						<div className='p-4 bg-white rounded-lg border border-gray-200 shadow-sm'>
							{/* Volume Control */}
							<div className='mb-4'>
								<label
									htmlFor='volume-control'
									className='block text-sm font-medium text-gray-700 mb-2'
								>
									🔊 Volume: {Math.round(volume * 100)}%
								</label>
								<input
									id='volume-control'
									type='range'
									min='0'
									max='1'
									step='0.1'
									value={volume}
									onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
									className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider'
									aria-label='Audio volume control'
								/>
							</div>

							{/* Speed Control */}
							<div className='mb-4'>
								<label
									htmlFor='speed-control'
									className='block text-sm font-medium text-gray-700 mb-2'
								>
									⚡ Speed: {speechRate}x
								</label>
								<input
									id='speed-control'
									type='range'
									min='0.5'
									max='2.0'
									step='0.1'
									value={speechRate}
									onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
									className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider'
									aria-label='Speech speed control'
								/>
								<div className='flex justify-between text-xs text-gray-500 mt-1'>
									<span>Slow</span>
									<span>Normal</span>
									<span>Fast</span>
								</div>
							</div>

							{/* Audio Control Buttons */}
							<div className='flex gap-2 justify-center'>
								<button
									onClick={handlePauseResume}
									disabled={!isSpeaking}
									className='flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-3 rounded text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400'
									title={isPaused ? 'Resume audio playback' : 'Pause audio playback'}
									aria-label={isPaused ? 'Resume audio' : 'Pause audio'}
								>
									{isPaused ? '▶️ Resume' : '⏸️ Pause'}
								</button>
								<button
									onClick={handleStop}
									disabled={!isSpeaking}
									className='flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-3 rounded text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-400'
									title='Stop audio playback'
									aria-label='Stop audio'
								>
									⏹️ Stop
								</button>
							</div>
						</div>
					</div>
				</div>

				<button
					onClick={handleListenClick}
					disabled={isSpeaking}
					className='bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-full text-lg shadow-lg disabled:bg-blue-300 disabled:cursor-not-allowed'
				>
					<span className='mr-2'>🔊</span> Listen
				</button>
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
					placeholder='Missing word...'
				/>
				<button
					type='submit'
					disabled={isRoundComplete || !userInput.trim()}
					className='bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-md disabled:bg-green-300 disabled:cursor-not-allowed'
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

// Componente de la pantalla de fin de juego con el nuevo diseño y paleta de colores.
const GameOverScreen = ({ results, onPlayAgain }) => {
	const correctAnswers = results.filter((r) => r.isCorrect);
	const incorrectAnswers = results.filter((r) => !r.isCorrect);
	const accuracy =
		results.length > 0 ? Math.round((correctAnswers.length / results.length) * 100) : 0;

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

	const renderQuestion = (question, answer) => {
		const parts = question.split('____');
		return (
			<p className='font-semibold text-gray-900 mb-1'>
				{parts[0]}
				<strong className='font-bold text-blue-600'>{answer}</strong>
				{parts[1]}
			</p>
		);
	};

	return (
		<div className='w-full max-w-4xl mx-auto my-16 bg-white shadow-2xl rounded-2xl p-4 sm:p-8 md:p-12 text-left'>
			<h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center'
				tabIndex={0}>
				Challenge Complete!
			</h1>

			{/* Resumen de puntaje principal */}
			<div className='text-center mb-8'>
				{/* Etiqueta para el puntaje */}
				<div className='text-lg font-medium text-gray-600 mb-1' tabIndex={0}>Score</div>

				{/* Resultado del puntaje */}
				<div className='text-4xl sm:text-5xl font-bold text-blue-600 mb-2' tabIndex={0}>
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
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>
						{correctAnswers.length}/{results.length}
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Correct Answers</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>{accuracy}%</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Accuracy Rate</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>{results.length}</div>
					<div className='text-sm text-gray-600' tabIndex={0}>Total Questions</div>
				</div>
			</div>

			<p className='text-gray-600 text-center mb-8 sm:mb-10'
				tabIndex={0}>
				Let's review your listening comprehension performance. Use this feedback to
				improve your auditory skills.
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
							Correct Answers ({correctAnswers.length})
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
										<div tabIndex={0}>
											{renderQuestion(r.question, r.correctAnswer)}
											<p className='text-sm text-gray-600' tabIndex={0}>
												Your answer:{' '}
												<span className='font-medium text-green-700' tabIndex={0}>{r.userAnswer}</span>
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
						<h2 className='text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center'
							tabIndex={0}>
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
											<p tabIndex={0}>{renderQuestion(r.question, r.correctAnswer)} </p>
											<p className='text-sm text-gray-600 mb-2'
												tabIndex={0}>
												Correct answer:{' '}
												<span className='font-medium text-blue-700' tabIndex={0}>
													{r.correctAnswer}
												</span>
											</p>
											<p className='text-sm text-gray-600 mb-2'
												tabIndex={0}>
												Your answer:{' '}
												<span className='font-medium text-blue-700' tabIndex={0}>{r.userAnswer}</span>
											</p>
											<p className='text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300'
												tabIndex={0}>
												Tip: Listen carefully to the pronunciation and context. Try to
												understand the meaning of the sentence to identify the missing
												word.
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
				<div className={`text-center ${performance.color} font-semibold`} tabIndex={0}>
					{finalScore >= 90 &&
						'Outstanding! Your listening skills are excellent. Keep up the great work!'}
					{finalScore >= 75 &&
						finalScore < 90 &&
						"👏 Good job! You're showing strong listening comprehension. A little more practice and you'll be perfect!"}
					{finalScore >= 60 &&
						finalScore < 75 &&
						"💪 You're making progress! Focus on listening carefully to pronunciation and context clues to improve your results."}
					{finalScore < 60 &&
						'Keep practicing! Listening skills take time to develop. Review the feedback and try again.'}
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

// Componente principal 'Listen' que gestiona el estado del juego
export const Listen = () => {
	// El estado del juego ahora comienza en 'playing'
	const [gameState, setGameState] = useState('playing');
	const [gameResults, setGameResults] = useState([]);
	const [isSupported, setIsSupported] = useState(true);
	const { user } = useAuth();

	useEffect(() => {
		if (!('speechSynthesis' in window)) {
			setIsSupported(false);
		}
	}, []);

	const handleGameOver = async (results) => {
		const score = results.filter((r) => r.isCorrect).length * 20;
		if (user && user.id) {
			const token = localStorage.getItem('token');
			await fetch(`${API_URL}/user/game-history`, {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
				body: JSON.stringify({
					userId: user.id,
					game: 'Listening Challenge',
					score: score,
				}),
			});
		}
		setGameResults(results);
		setGameState('over');
	};

	const handlePlayAgain = () => {
		// Al jugar de nuevo, reiniciamos el estado a 'playing'
		setGameResults([]);
		setGameState('playing');
	};

	if (!isSupported) {
		return <p>Sorry, your browser does not support Speech Synthesis.</p>;
	}

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

export default Listen;
