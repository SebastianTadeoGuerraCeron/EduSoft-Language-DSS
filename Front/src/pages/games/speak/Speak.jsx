import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { API_URL } from '../../../API';
import { useAuth } from '../../../context/AuthContext';
import { SENTENCES_STACK_FOR_SPEAKING } from '../CONST_VALUES';
import { HeaderGame } from '../../../components/HeaderGame';
import { getRandomElements } from '../../../utils/gameRandomization';

// Solo 5 rondas como solicitaste
const TOTAL_PRONUNCIATION_ROUNDS = 5;

// Usando utility function documentada para aleatorización no-crítica en juegos
const shuffleAndPick = (arr, num) => {
	return getRandomElements(arr, num);
};

// --- Enhanced Scoring System ---
const calculateSentenceScore = (originalSentence, transcribedSentence, confidence) => {
	// Normalize sentences for comparison
	const normalize = (text) => {
		return text
			.toLowerCase()
			.replace(/[.,!?;:]/g, '') // Remove punctuation
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
	};

	const original = normalize(originalSentence);
	const transcribed = normalize(transcribedSentence);

	// Calculate word-level similarity
	const originalWords = original.split(' ');
	const transcribedWords = transcribed.split(' ');

	let matchingWords = 0;
	const maxLength = Math.max(originalWords.length, transcribedWords.length);

	// Count matching words (position-independent)
	const originalWordCount = {};
	const transcribedWordCount = {};

	originalWords.forEach((word) => {
		originalWordCount[word] = (originalWordCount[word] || 0) + 1;
	});

	transcribedWords.forEach((word) => {
		transcribedWordCount[word] = (transcribedWordCount[word] || 0) + 1;
	});

	// Calculate matches
	Object.keys(originalWordCount).forEach((word) => {
		if (transcribedWordCount[word]) {
			matchingWords += Math.min(originalWordCount[word], transcribedWordCount[word]);
		}
	});

	// Calculate similarity percentage
	const wordSimilarity = maxLength > 0 ? matchingWords / originalWords.length : 0;

	// Combine word similarity with confidence
	const finalScore = wordSimilarity * 0.7 + confidence * 0.3;

	return {
		wordSimilarity: wordSimilarity,
		confidence: confidence,
		finalScore: finalScore,
		isCorrect: finalScore >= 0.7 && confidence >= 0.7,
	};
};

// --- PronunciationGameScreen Component (Core Game Logic) ---
const PronunciationGameScreen = ({ onGameOver, isSupported }) => {
	const [gameSentences, setGameSentences] = useState([]);
	const [currentSentence, setCurrentSentence] = useState('');
	const [roundsPlayed, setRoundsPlayed] = useState(0);
	const [statusMessage, setStatusMessage] = useState(
		'Ready? Press "Listen" to hear the sentence!'
	);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const [hasRecorded, setHasRecorded] = useState(false);
	const [currentTranscript, setCurrentTranscript] = useState('');

	// Audio control states
	const [volume, setVolume] = useState(0.8); // Default volume at 80%
	const [speechRate, setSpeechRate] = useState(0.8); // Speech rate control
	const [isPaused, setIsPaused] = useState(false);
	const [currentUtterance, setCurrentUtterance] = useState(null);
	const [showAudioControls, setShowAudioControls] = useState(false);

	const recognitionRef = useRef(null);
	const [results, setResults] = useState([]);

	// Initialize sentences when component mounts
	useEffect(() => {
		const shuffled = shuffleAndPick(
			SENTENCES_STACK_FOR_SPEAKING,
			TOTAL_PRONUNCIATION_ROUNDS
		);
		setGameSentences(shuffled);
	}, []);

	// Set current sentence for each round
	useEffect(() => {
		if (gameSentences.length > 0 && roundsPlayed < gameSentences.length) {
			setCurrentSentence(gameSentences[roundsPlayed].sentence);
			setStatusMessage('Ready? Press "Listen" to hear the sentence!');
			setIsSpeaking(false);
			setIsListening(false);
			setHasRecorded(false);
			setCurrentTranscript('');
			setIsPaused(false);
			setCurrentUtterance(null);

			if (window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}
		}
	}, [roundsPlayed, gameSentences]);

	// Speech Recognition Setup
	useEffect(() => {
		if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
			setStatusMessage(
				'Speech Recognition not supported in this browser. Please use Chrome for best experience.'
			);
			return;
		}

		const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
		const newRecognition = new SpeechRecognition();
		newRecognition.continuous = false;
		newRecognition.interimResults = false;
		newRecognition.lang = 'en-US';

		newRecognition.onstart = () => {
			setIsListening(true);
			setStatusMessage('Listening... Speak the sentence now.');
		};

		newRecognition.onresult = (event) => {
			setIsListening(false);
			const transcript = event.results[0][0].transcript;
			const confidence = event.results[0][0].confidence;

			setCurrentTranscript(transcript);
			setHasRecorded(true);
			setStatusMessage(
				'Recording complete! Press "Next" to continue or "Speak" to try again.'
			);

			console.log(`You said: "${transcript}" (Confidence: ${confidence.toFixed(2)})`);
		};

		newRecognition.onerror = (event) => {
			setIsListening(false);
			console.error('Speech Recognition Error:', event.error);

			if (event.error === 'not-allowed') {
				setStatusMessage(
					'Microphone access denied. Please allow microphone in browser settings.'
				);
			} else if (event.error === 'no-speech') {
				setStatusMessage('No speech detected. Please press "Speak" and try again.');
			} else if (event.error === 'network') {
				setStatusMessage(
					'Network error. Could not reach speech recognition services. Check your internet connection and try again.'
				);
			} else if (event.error === 'aborted') {
				console.log(
					'Speech recognition aborted (likely intentional or next round transition).'
				);
			} else {
				setStatusMessage(`Error: ${event.error}. Please try again.`);
			}
		};

		newRecognition.onend = () => {
			console.log('Speech Recognition ended.');
			if (isListening) {
				setIsListening(false);
			}
		};

		recognitionRef.current = newRecognition;

		return () => {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.abort();
					recognitionRef.current = null;
				} catch (error) {
					console.warn('Error cleaning up recognition on unmount:', error);
				}
			}
			// Cancel any ongoing speech synthesis
			if (window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}
		};
	}, [isListening]);

	// Function to handle Listen button click (Speech Synthesis)
	const handleListenClick = useCallback(() => {
		if (!currentSentence || isListening) return;

		if (recognitionRef.current && isListening) {
			recognitionRef.current.abort();
			setIsListening(false);
		}

		// Cancel any existing speech
		if (window.speechSynthesis.speaking) {
			window.speechSynthesis.cancel();
		}

		setIsSpeaking(true);
		setIsPaused(false);

		const utterance = new SpeechSynthesisUtterance(currentSentence);
		utterance.lang = 'en-US';
		utterance.rate = speechRate;
		utterance.volume = volume;

		utterance.onend = () => {
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);
			setStatusMessage('Now press "Speak" to repeat the sentence!');
		};

		utterance.onerror = (event) => {
			console.error('Speech Synthesis Error:', event.error);
			setIsSpeaking(false);
			setIsPaused(false);
			setCurrentUtterance(null);
			setStatusMessage('Error speaking the sentence. Try again.');
		};

		setCurrentUtterance(utterance);
		window.speechSynthesis.speak(utterance);
	}, [currentSentence, isListening, speechRate, volume]);

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
			setStatusMessage('Audio stopped. Press "Listen" to play again.');
		}
	}, [currentUtterance]);

	const handleVolumeChange = useCallback((newVolume) => {
		setVolume(newVolume);
	}, []);

	const handleSpeedChange = useCallback((newRate) => {
		setSpeechRate(newRate);
	}, []);

	// Function to handle Speak button click (Speech Recognition)
	const handleSpeakClick = useCallback(() => {
		if (!recognitionRef.current || !isSupported) {
			setStatusMessage(
				'Speech Recognition not available or not supported by your browser.'
			);
			return;
		}

		if (isListening) {
			try {
				recognitionRef.current.abort();
				setStatusMessage('Recording stopped. Press "Speak" to try again.');
			} catch (error) {
				console.warn('Error stopping recognition:', error);
			}
		} else {
			if (window.speechSynthesis.speaking) {
				window.speechSynthesis.cancel();
			}

			try {
				recognitionRef.current.start();
			} catch (error) {
				console.error('Error starting recognition:', error);
				if (error.name === 'AbortError') {
					setStatusMessage(
						'Microphone already in use or previous recognition not fully stopped. Please try again.'
					);
				} else if (error.name === 'NotAllowedError') {
					setStatusMessage(
						'Microphone access denied. Please allow microphone in browser settings.'
					);
				} else {
					setStatusMessage('Error starting speech recognition. Please try again.');
				}
				setIsListening(false);
			}
		}
	}, [isListening, isSupported]);

	const handleNextClick = useCallback(() => {
		if (!hasRecorded || !currentTranscript) {
			setStatusMessage('Please record your pronunciation first!');
			return;
		}

		const scoreResult = calculateSentenceScore(currentSentence, currentTranscript, 0.85);

		let roundResult = {
			sentence: currentSentence,
			transcript: currentTranscript,
			isCorrect: scoreResult.finalScore >= 0.7,
			confidence: scoreResult.confidence,
			wordSimilarity: scoreResult.wordSimilarity,
			finalScore: scoreResult.finalScore,
		};

		if (roundsPlayed + 1 >= TOTAL_PRONUNCIATION_ROUNDS) {
			const updatedResults = [...results, roundResult];
			const totalFinalScore = updatedResults.reduce(
				(acc, r) => acc + (r.finalScore || 0),
				0
			);
			const normalizedScore = Math.round(
				(totalFinalScore / TOTAL_PRONUNCIATION_ROUNDS) * 100
			);
			setResults(updatedResults);
			onGameOver(normalizedScore, updatedResults);
		} else {
			setResults((prev) => [...prev, roundResult]);
			setRoundsPlayed((prev) => prev + 1);
		}

		if (isListening && recognitionRef.current) {
			try {
				recognitionRef.current.abort();
			} catch (error) {
				console.warn('Error aborting recognition before next round:', error);
			}
			setIsListening(false);
		}
	}, [
		roundsPlayed,
		onGameOver,
		isListening,
		hasRecorded,
		currentTranscript,
		currentSentence,
		results,
	]);

	const getAverageScore = () => {
		let tempResults = results;
		if (hasRecorded && currentTranscript && roundsPlayed < TOTAL_PRONUNCIATION_ROUNDS) {
			const scoreResult = calculateSentenceScore(
				currentSentence,
				currentTranscript,
				0.85
			);
			tempResults = [
				...results,
				{
					sentence: currentSentence,
					transcript: currentTranscript,
					isCorrect: scoreResult.finalScore >= 0.7,
					confidence: scoreResult.confidence,
					wordSimilarity: scoreResult.wordSimilarity,
					finalScore: scoreResult.finalScore,
				},
			];
		}
		if (tempResults.length === 0) return 0;
		const total = tempResults.reduce((acc, r) => acc + (r.finalScore || 0) * 100, 0);
		return Math.round(total / tempResults.length);
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
				typeGame='Speak'
				title='Pronunciation Challenge'
				currentStep={roundsPlayed + 1}
				totalSteps={TOTAL_PRONUNCIATION_ROUNDS}
				score={getAverageScore()}
			/>

			<div className='mb-8 flex flex-col items-center'>
				<div
					className='text-base sm:text-lg lg:text-2xl xl:text-3xl font-bold text-gray-800 mb-6 bg-white lg:bg-gray-100 p-4 sm:p-6 rounded-lg w-full max-w-4xl text-center leading-relaxed border border-gray-200 lg:border-0 shadow-sm lg:shadow-none'
					tabIndex={0}
				>
					{currentSentence}
				</div>
				{hasRecorded && currentTranscript && (
					<div className='mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200'>
						<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
							Your pronunciation:
						</p>
						<p className='text-lg font-medium text-blue-800' tabIndex={0}>
							"{currentTranscript}"
						</p>
					</div>
				)}

				{/* Audio Controls - Compact and Collapsible */}
				<div className='mb-6 w-full max-w-md'>
					{/* Audio Control Toggle Button */}
					<button
						onClick={() => setShowAudioControls(!showAudioControls)}
						className='w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-150 rounded-lg border border-gray-200 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400'
						aria-expanded={showAudioControls}
						aria-controls='audio-controls-panel'
					>
						<span className='text-sm font-medium text-gray-700' tabIndex={0}>
							🎛️ Audio Settings
						</span>
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
									tabIndex={0}
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
									tabIndex={0}
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
									<span tabIndex={0}>Slow</span>
									<span tabIndex={0}>Normal</span>
									<span tabIndex={0}>Fast</span>
								</div>
							</div>

							{/* Audio Control Buttons */}
							<div className='flex gap-2 justify-center'>
								<button
									onClick={handlePauseResume}
									disabled={!isSpeaking || isListening}
									className='flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-3 rounded text-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400'
									title={isPaused ? 'Resume audio playback' : 'Pause audio playback'}
									aria-label={isPaused ? 'Resume audio' : 'Pause audio'}
								>
									{isPaused ? '▶️ Resume' : '⏸️ Pause'}
								</button>
								<button
									onClick={handleStop}
									disabled={!isSpeaking || isListening}
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

				<div className='flex flex-wrap gap-4 justify-center'>
					<button
						onClick={handleListenClick}
						disabled={isSpeaking || isListening || !isSupported}
						className='bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-lg text-xl shadow-md disabled:bg-gray-200 disabled:cursor-not-allowed'
					>
						🔊 Listen
					</button>
					<button
						onClick={handleSpeakClick}
						disabled={isSpeaking || !isSupported}
						className={`font-bold py-3 px-6 rounded-lg text-xl shadow-md ${isListening
								? 'bg-red-500 hover:bg-red-600 text-white'
								: 'bg-blue-600 hover:bg-blue-700 text-white'
							} disabled:opacity-50 disabled:cursor-not-allowed`}
						title={!isSupported ? 'Speech Recognition not supported' : ''}
					>
						{isListening ? '🛑 Stop' : '🎤 Speak'}
					</button>
					<button
						onClick={handleNextClick}
						disabled={isListening || isSpeaking || !hasRecorded}
						className='bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-md disabled:bg-green-300 disabled:cursor-not-allowed'
					>
						Next ➔
					</button>
				</div>
			</div>

			<div className='h-16 flex flex-col items-center justify-center p-4 rounded-lg bg-gray-100 text-lg'>
				<div
					dangerouslySetInnerHTML={{ __html: statusMessage }}
					tabIndex={0}
					role='status'
					aria-live='polite'
				/>
			</div>
		</div>
	);
};

// --- PronunciationGameOverScreen Component (Pantalla de resultados mejorada y con nueva paleta de colores) ---
const PronunciationGameOverScreen = ({ finalScore, results, onPlayAgain }) => {
	const correctAnswers = results.filter((r) => r.isCorrect);
	const incorrectAnswers = results.filter((r) => !r.isCorrect);
	const accuracy =
		results.length > 0 ? Math.round((correctAnswers.length / results.length) * 100) : 0;
	const avgConfidence =
		results.length > 0
			? Math.round(
				(results.reduce((acc, r) => acc + (r.confidence || 0), 0) / results.length) *
				100
			)
			: 0;

	const getPerformanceLevel = (score) => {
		if (score >= 90)
			return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
		if (score >= 75) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
		if (score >= 60)
			return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
		return { level: 'Needs Practice', color: 'text-gray-600', bg: 'bg-gray-100' }; // Cambiado de rojo a gris
	};

	const performance = getPerformanceLevel(finalScore);

	return (
		<div className='w-full max-w-4xl mx-auto my-16 bg-white shadow-2xl rounded-2xl p-4 sm:p-8 md:p-12 text-left'>
			<h1
				className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center'
				tabIndex={0}
			>
				Challenge Complete!
			</h1>

			{/* Resumen de puntaje principal */}
			<div className='text-center mb-8'>
				{/* Etiqueta para el puntaje */}
				<div className='text-lg font-medium text-gray-600 mb-1' tabIndex={0}>
					Score
				</div>

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
					<div className='text-sm text-gray-600' tabIndex={0}>
						Correct Pronunciations
					</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>
						{accuracy}%
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>
						Accuracy Rate
					</div>
				</div>
				<div className='bg-gray-50 p-4 rounded-lg text-center'>
					<div className='text-2xl font-bold text-gray-800' tabIndex={0}>
						{avgConfidence}%
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>
						Avg. Confidence
					</div>
				</div>
			</div>

			<p className='text-gray-600 text-center mb-8 sm:mb-10' tabIndex={0}>
				Let's review your pronunciation performance. Use this feedback to improve your
				speaking skills.
			</p>

			<div className='space-y-8'>
				{/* Sección de respuestas correctas */}
				{correctAnswers.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-green-700 mb-4 flex items-center'
							tabIndex={0}
						>
							<span className='bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✓
							</span>
							Well Pronounced ({correctAnswers.length})
						</h2>
						<div className='space-y-3'>
							{correctAnswers.map((r, i) => (
								<div
									key={i}
									className='p-4 bg-green-50 border border-green-200 rounded-lg'
								>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-green-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}
										>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-1' tabIndex={0}>
												"{r.sentence}"
											</p>
											<p className='text-sm text-gray-600' tabIndex={0}>
												Your pronunciation:{' '}
												<span className='font-medium text-green-700'>
													"{r.transcript}"
												</span>
											</p>
											<div className='flex gap-4 text-xs text-gray-500 mt-1' tabIndex={0}>
												<span>Confidence: {Math.round((r.confidence || 0) * 100)}%</span>
												<span>
													Word Match: {Math.round((r.wordSimilarity || 0) * 100)}%
												</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Sección de respuestas incorrectas (con colores ajustados) */}
				{incorrectAnswers.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center'
							tabIndex={0}
						>
							<span className='bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✗
							</span>
							Areas for Improvement ({incorrectAnswers.length})
						</h2>
						<div className='space-y-3'>
							{incorrectAnswers.map((r, i) => (
								<div key={i} className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-gray-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}
										>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-1' tabIndex={0}>
												"{r.sentence}"
											</p>
											<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
												Your pronunciation:{' '}
												<span className='font-medium text-blue-700'>
													"{r.transcript || 'No speech detected'}"
												</span>
											</p>
											<div className='flex gap-4 text-xs text-gray-500 mb-2' tabIndex={0}>
												<span>Confidence: {Math.round((r.confidence || 0) * 100)}%</span>
												<span>
													Word Match: {Math.round((r.wordSimilarity || 0) * 100)}%
												</span>
											</div>
											<p
												className='text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300'
												tabIndex={0}
											>
												Tip: Try pronouncing each word slowly and clearly. Focus on
												consonant clusters and vowel sounds.
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
						'Outstanding! Your pronunciation is excellent. Keep up the great work!'}
					{finalScore >= 75 &&
						finalScore < 90 &&
						"👏 Good job! You're showing strong pronunciation skills. A little more practice and you'll be perfect!"}
					{finalScore >= 60 &&
						finalScore < 75 &&
						"💪 You're making progress! Focus on the areas for improvement and you'll see great results."}
					{finalScore < 60 &&
						'Keep practicing! Pronunciation takes time to master. Review the feedback and try again.'}
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

// --- Main Component 'PronunciationChallenge' (Manages Game State) ---
export const PronunciationChallenge = () => {
	const [gameState, setGameState] = useState('playing');
	const [finalScore, setFinalScore] = useState(0);
	const [gameResults, setGameResults] = useState([]);
	const [isSupported, setIsSupported] = useState(true);
	const { user } = useAuth();

	useEffect(() => {
		if (
			!('speechSynthesis' in window) ||
			!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
		) {
			setIsSupported(false);
		}
	}, []);

	const handleGameOver = async (score, results) => {
		setFinalScore(score);
		setGameResults(results);
		setGameState('over');

		// Registrar el puntaje en el backend si hay usuario
		if (user && user.id) {
			try {
				const token = localStorage.getItem('token');
				await fetch(`${API_URL}/user/game-history`, {
					method: 'POST',
					headers: { 
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`,
					},
					body: JSON.stringify({
						userId: user.id,
						game: 'Speaking Challenge',
						score: score,
					}),
				});
			} catch (e) {
				console.warn('Could not save pronunciation score:', e);
			}
		}
	};

	const handlePlayAgain = () => {
		window.location.reload();
	};

	if (!isSupported) {
		return (
			<div className='w-full flex-grow flex items-center justify-center p-4'>
				<p
					className='text-red-600 text-lg font-semibold text-center'
					tabIndex={0}
					role='alert'
				>
					Sorry, your browser does not fully support the required Speech Synthesis and
					Speech Recognition features for this game.
					<br />
					Please try using Google Chrome for the best experience.
				</p>
			</div>
		);
	}

	const renderGameState = () => {
		switch (gameState) {
			case 'playing':
				return (
					<PronunciationGameScreen
						onGameOver={handleGameOver}
						isSupported={isSupported}
					/>
				);
			case 'over':
				return (
					<PronunciationGameOverScreen
						finalScore={finalScore}
						results={gameResults}
						onPlayAgain={handlePlayAgain}
					/>
				);
			default:
				return (
					<PronunciationGameScreen
						onGameOver={handleGameOver}
						isSupported={isSupported}
					/>
				);
		}
	};

	return (
		<div className='w-full flex-grow flex items-center justify-center p-4'>
			{renderGameState()}
		</div>
	);
};

export { PronunciationChallenge as Speak };
