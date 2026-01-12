import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router';
import { API_URL } from '../../../API';
import { HeaderGame } from '../../../components/HeaderGame';
import { useAuth } from '../../../context/AuthContext';
import { SENTENCES_STACK_FOR_GRAMMAR } from '../CONST_VALUES';
import { getRandomElements, shuffleSentence } from '../../../utils/gameRandomization';

// Mezclar el orden de las oraciones y tomar 5 primeras
// Usando función helper documentada para aleatorización no-crítica en juegos
const sentences = getRandomElements(SENTENCES_STACK_FOR_GRAMMAR, 5);

const shuffled = sentences.map((s) => shuffleSentence(s));

export const Grammar = () => {
	const total = sentences.length;
	const [step, setStep] = useState(0);
	const [dock, setDock] = useState(shuffled[0]);
	const [placed, setPlaced] = useState([]);
	const [verified, setVerified] = useState(false);
	const [results, setResults] = useState([]);
	const [finished, setFinished] = useState(false);
	const [score, setScore] = useState(0);
	const { user } = useAuth(); // 5 ejercicios x 20 pts

	const correctSentence = sentences[step];

	/* mover palabra */
	const move = (w, fromDock) => {
		if (verified) return;
		fromDock
			? (setDock(dock.filter((x) => x !== w)), setPlaced([...placed, w]))
			: (setPlaced(placed.filter((x) => x !== w)), setDock([...dock, w]));
	};

	/* verificar */
	const handleVerify = () => {
		const userAnswer = placed.join(' ');
		setVerified(true);
		const correctArr = correctSentence.split(' ');
		let correctCount = 0;
		for (let i = 0; i < correctArr.length; i++) {
			if (placed[i] === correctArr[i]) correctCount++;
		}
		// Calcular la puntuación del ejercicio en base a respuestas correctas parciales
		// Cada ejercicio vale 20 puntos como máximo
		const exerciseScore = Math.round((correctCount / correctArr.length) * 20);
		// Se marca como correcto solo si todas las palabras están en la posición correcta
		setScore((prev) => prev + exerciseScore);
		setResults([
			...results,
			{
				question: 'Arrange the words to form a correct sentence:',
				userAnswer,
				correctAnswer: correctSentence,
				isCorrect: correctCount === correctArr.length,
				exerciseScore,
				correctCount,
				totalWords: correctArr.length,
			},
		]);
	};

	/* avanzar */
	const handleNext = () => {
		setStep((c) => c + 1);
		setDock(shuffled[step + 1]);
		setPlaced([]);
		setVerified(false);
	};

	/* terminar */
	const handleFinish = async () => {
		setFinished(true);

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
					game: 'Grammar Challenge',
					score: score,
				}),
			});
		}
	};

	/* componente palabra completamente navegable */
	const Word = ({ w, fromDock, idx }) => {
		const correct = verified && placed[idx] === correctSentence.split(' ')[idx];
		const wrong = verified && placed[idx] && !correct;

		const handleKeyDown = (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (!verified) {
					move(w, fromDock);
				}
			}
		};

		return (
			<motion.button
				layout
				whileTap={{ scale: 0.9 }}
				disabled={verified}
				onClick={() => move(w, fromDock)}
				onKeyDown={handleKeyDown}
				tabIndex={verified ? -1 : 0}
				aria-label={`Word: ${w}. ${fromDock
						? 'Press to move to the sentence'
						: 'Press to return to the bank'
					}`}
				className={`px-3 py-1 m-1 rounded shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all ${correct
						? 'bg-green-300 border-2 border-green-500'
						: wrong
							? 'bg-red-300 border-2 border-red-500'
							: 'bg-white border border-gray-300 hover:bg-gray-50'
					} ${verified ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:shadow-md'
					}`}
			>
				{w}
			</motion.button>
		);
	};

	/* pantalla de resultados */
	if (finished)
		return (
			<GameResumeDetails
				results={results}
				score={score}
				onPlayAgain={() => window.location.reload()}
			/>
		);

	/* UI principal con TODAS las etiquetas navegables */
	return (
		<section className='max-w-2xl mx-auto p-4 sm:p-6 space-y-6 select-none'>
			<HeaderGame
				typeGame={'Grammar'}
				title={'Arrange the words in order'}
				totalSteps={sentences.length}
				currentStep={step + 1}
				score={score}
			/>
			{/* Constructed sentence - NAVIGABLE AREA */}
			<div
				className='w-full border-2 border-green-400 rounded-xl flex flex-wrap gap-0 bg-gradient-to-r from-green-50 via-green-100 to-green-50 shadow-inner py-4 px-2 min-h-[56px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
				tabIndex={0}
				aria-label='Sentence construction area'
			>
				<h3 className='sr-only'>Sentence Construction Area</h3>

				{placed.length === 0 && (
					<div
						className='text-gray-500 italic p-2 text-center w-full focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
						aria-label='Empty area. Place words here to build your sentence'
					>
						Place words here to build your sentence
					</div>
				)}

				{placed.map((w, i) => (
					<span key={w + i} className='inline-flex items-center'>
						<Word w={w} idx={i} fromDock={false} />
						{/* navigable correction */}
						{verified && placed[i] !== correctSentence.split(' ')[i] && (
							<span
								className='ml-1 italic text-green-700 text-sm bg-green-100 px-1 rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
								tabIndex={0}
								aria-label={`Correction: correct word is ${correctSentence.split(' ')[i]
									}`}
							>
								{correctSentence.split(' ')[i]}
							</span>
						)}
					</span>
				))}
			</div>
			{dock.length > 0 && (
				<div
					className='w-full border-2 border-sky-400 rounded-xl flex flex-wrap justify-center items-center gap-2 bg-gradient-to-r from-sky-100 via-sky-200 to-sky-100 shadow-inner py-4 px-2 min-h-[56px] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2'
					tabIndex={0}
					aria-label={`Word bank with ${dock.length} words available`}
				>
					<h3 className='sr-only'>Word Bank</h3>
					{dock.map((w) => (
						<Word key={w} w={w} fromDock={true} />
					))}
				</div>
			)}
			<div
				className='text-center text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
				tabIndex={0}
				aria-label={`Current state: ${placed.length} words in sentence, ${dock.length} words in bank`}
			>
				Words in sentence: <span className='font-semibold'>{placed.length}</span> | Words
				available: <span className='font-semibold'>{dock.length}</span>
			</div>
			{/* navigable buttons */}
			<div className='flex flex-col justify-center sm:flex-row gap-3 sm:gap-4'>
				{!verified && (
					<button
						onClick={handleVerify}
						disabled={placed.length === 0}
						tabIndex={0}
						aria-label={`Verify sentence. ${placed.length === 0
								? 'Place at least one word first'
								: `Current sentence: ${placed.join(' ')}`
							}`}
						className='bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-blue-700 transition-colors font-medium'
					>
						Verify
					</button>
				)}

				{verified && step < total - 1 && (
					<button
						onClick={handleNext}
						tabIndex={0}
						aria-label={`Continue to the next exercise ${step + 2} of ${total}`}
						className='bg-green-500 text-white px-6 py-3 rounded-lg shadow hover:bg-green-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium'
					>
						Next ➔
					</button>
				)}

				{verified && step === total - 1 && (
					<button
						onClick={handleFinish}
						tabIndex={0}
						aria-label={`Terminar juego y ver resultados. Puntaje actual: ${score} puntos`}
						className='bg-neutral-700 text-white px-6 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 hover:bg-neutral-800 transition-colors font-medium'
					>
						Finish
					</button>
				)}
			</div>
			{/* feedback general - COMPLETAMENTE NAVEGABLE */}
			{verified && (
				<div
					className={`p-4 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 ${placed.join(' ') === correctSentence
							? 'bg-green-50 border-green-300 focus:ring-green-500'
							: 'bg-red-50 border-red-300 focus:ring-red-500'
						}`}
					tabIndex={0}
					aria-label={`Verification result: ${placed.join(' ') === correctSentence
							? 'Correct sentence'
							: 'Incorrect sentence'
						}`}
				>
					<div className='flex items-center gap-2'>
						<span
							className='text-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
							tabIndex={0}
							aria-label={
								placed.join(' ') === correctSentence ? 'Success icon' : 'Error icon'
							}
						>
							{placed.join(' ') === correctSentence ? 'CORRECT' : 'INCORRECT'}
						</span>
						<div>
							<p
								className={`font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${placed.join(' ') === correctSentence ? 'text-green-600' : 'text-red-600'
									}`}
								tabIndex={0}
							>
								{placed.join(' ') === correctSentence
									? 'Excellent! The sentence is correct.'
									: 'Some words are in the wrong position.'}
							</p>
							{placed.join(' ') !== correctSentence && (
								<p
									className='text-sm mt-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
									tabIndex={0}
								>
									Review the corrections shown in green above.
								</p>
							)}
						</div>
					</div>
				</div>
			)}
			{/* Información de la oración correcta - NAVEGABLE */}
			{verified && (
				<div
					className='bg-gray-100 p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
					tabIndex={0}
				>
					<h4
						className='font-semibold text-gray-700 mb-1 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
						tabIndex={0}
					>
						Correct sentence:
					</h4>
					<p
						className='text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
						tabIndex={0}
						aria-label={`The correct sentence is: ${correctSentence}`}
					>
						"{correctSentence}"
					</p>
					<p
						className='text-sm text-gray-600 mt-1 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						Your answer: "{placed.join(' ')}"
					</p>
				</div>
			)}
			{/* Ayuda de navegación - NAVEGABLE */}
			<details
				className='bg-gray-50 p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
				tabIndex={0}
			>
				<summary
					className='cursor-pointer font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:text-blue-600'
					tabIndex={0}
				>
					⌨️ Navigation Instructions
				</summary>
				<div className='mt-2 space-y-2'>
					<p
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						• Use <kbd className='bg-gray-200 px-1 rounded'>Tab</kbd> to navigate between
						all elements
					</p>
					<p
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						• Use <kbd className='bg-gray-200 px-1 rounded'>Enter</kbd> or{' '}
						<kbd className='bg-gray-200 px-1 rounded'>Space</kbd> to move words
					</p>
					<p
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						• All texts and elements are navigable with Tab
					</p>
				</div>
			</details>
		</section>
	);
};

const GameResumeDetails = ({ results, score, onPlayAgain }) => {
	const correctAnswers = results.filter((r) => r.isCorrect);
	const incorrectAnswers = results.filter((r) => !r.isCorrect);
	const accuracy =
		results.length > 0 ? Math.round((correctAnswers.length / results.length) * 100) : 0;

	const getPerformanceLevel = (score) => {
		if (score >= 90)
			return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
		if (score >= 75) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
		if (score >= 60)
			return { level: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
		return { level: 'Needs Practice', color: 'text-gray-600', bg: 'bg-gray-100' };
	};

	const performance = getPerformanceLevel(score);

	return (
		<div className='w-full max-w-4xl mx-auto my-16 bg-white shadow-2xl rounded-2xl p-4 sm:p-8 md:p-12 text-left'>
			{/* Main Title - Navigable */}
			<h1
				className='text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
				tabIndex={0}
			>
				Complete Grammar Challenge Results
			</h1>

			{/* Main Score Summary - ALL ELEMENTS NAVIGABLE */}
			<div className='text-center mb-8'>
				{/* Label for score - Navigable */}
				<div
					className='text-lg font-medium text-gray-600 mb-1 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
					tabIndex={0}
				>
					Final Score
				</div>

				{/* Score result - Navigable */}
				<div
					className='text-4xl sm:text-5xl font-bold text-blue-600 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					tabIndex={0}
					aria-label={`Your final score is ${score} out of 100 points`}
				>
					{score}
				</div>

				{/* Performance Level - Navigable */}
				<div
					className={`inline-block px-4 py-2 rounded-full font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${performance.bg} ${performance.color}`}
					tabIndex={0}
					aria-label={`Performance level: ${performance.level}`}
				>
					{performance.level}
				</div>
			</div>

			{/* Detailed Statistics Title - Navigable */}
			<h2
				className='text-xl font-bold text-gray-800 mb-4 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
				tabIndex={0}
			>
				Detailed Statistics
			</h2>

			{/* Detailed Statistics - ALL ELEMENTS NAVIGABLE */}
			<div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8'>
				<div
					className='bg-gray-50 p-4 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					tabIndex={0}
					aria-label={`Correct sentences: ${correctAnswers.length} out of ${results.length}`}
				>
					<div
						className='text-2xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
						tabIndex={0}
					>
						{correctAnswers.length}/{results.length}
					</div>
					<div
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						Correct Sentences
					</div>
				</div>
				<div
					className='bg-gray-50 p-4 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					tabIndex={0}
					aria-label={`Accuracy: ${accuracy} percent`}
				>
					<div
						className='text-2xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
						tabIndex={0}
					>
						{accuracy}%
					</div>
					<div
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						Accuracy
					</div>
				</div>
				<div
					className='bg-gray-50 p-4 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					tabIndex={0}
					aria-label={`Total Exercises: ${results.length}`}
				>
					<div
						className='text-2xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
						tabIndex={0}
					>
						{results.length}
					</div>
					<div
						className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
						tabIndex={0}
					>
						Total Exercises
					</div>
				</div>
			</div>

			{/* Description - Navigable */}
			<p
				className='text-gray-600 text-center mb-8 sm:mb-10 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
				tabIndex={0}
			>
				Review your grammar performance. Use this feedback to improve your skills.
			</p>

			<div className='space-y-8'>
				{/* Correct Answers Section - TITLES AND CONTENT NAVIGABLE */}
				{correctAnswers.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-green-700 mb-4 flex items-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
							tabIndex={0}
						>
							<span
								className='bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2'
								tabIndex={0}
								aria-label='Success Icon'
							>
								✓
							</span>
							Correct Sentences ({correctAnswers.length})
						</h2>
						<div className='space-y-3'>
							{correctAnswers.map((r, i) => (
								<div
									key={i}
									className='p-4 bg-green-50 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
									tabIndex={0}
									aria-label={`Exercise ${results.indexOf(r) + 1} correct`}
								>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-green-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2'
											tabIndex={0}
											aria-label={`Exercise number ${results.indexOf(r) + 1}`}
										>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p
												className='font-semibold text-gray-900 mb-1 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
												tabIndex={0}
											>
												"{r.correctAnswer}"
											</p>
											<p
												className='text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
												tabIndex={0}
											>
												Your answer:{' '}
												<span
													className='font-medium text-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2'
													tabIndex={0}
												>
													"{r.userAnswer}"
												</span>
											</p>
											<div className='flex gap-4 text-xs text-gray-500 mt-1'>
												<span
													className='focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
													tabIndex={0}
												>
													Words: {r.totalWords}
												</span>
												<span
													className='focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
													tabIndex={0}
												>
													Score: {r.exerciseScore}/20
												</span>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				)}

				{/* Incorrect Answers Section - TITLES AND CONTENT NAVIGABLE */}
				{incorrectAnswers.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
							tabIndex={0}
						>
							<span
								className='bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
								tabIndex={0}
								aria-label='Improvement Icon'
							>
								✗
							</span>
							Areas for Improvement ({incorrectAnswers.length})
						</h2>
						<div className='space-y-3'>
							{incorrectAnswers.map((r, i) => (
								<div
									key={i}
									className='p-4 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
									tabIndex={0}
									aria-label={`Exercise ${results.indexOf(r) + 1} for improvement`}
								>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-gray-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
											tabIndex={0}
											aria-label={`Exercise number ${results.indexOf(r) + 1}`}
										>
											{results.indexOf(r) + 1}
										</div>
										<div>
											<p
												className='font-semibold text-gray-900 mb-1 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
												tabIndex={0}
											>
												Correct: "{r.correctAnswer}"
											</p>
											<p
												className='text-sm text-gray-600 mb-2 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
												tabIndex={0}
											>
												Your attempt:{' '}
												<span
													className='font-medium text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
													tabIndex={0}
												>
													"{r.userAnswer}"
												</span>
											</p>
											<div className='flex gap-4 text-xs text-gray-500 mb-2'>
												<span
													className='focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
													tabIndex={0}
												>
													Correct words: {r.correctCount}/{r.totalWords}
												</span>
												<span
													className='focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
													tabIndex={0}
												>
													Score: {r.exerciseScore}/20
												</span>
											</div>
											<p
												className='text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2'
												tabIndex={0}
											>
												Tip: Pay attention to sentence structure and word order.
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</section>
				)}
			</div>

			{/* Motivational Message - Navigable */}
			<div
				className={`mt-8 p-4 rounded-lg ${performance.bg} border border-opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
				tabIndex={0}
			>
				<div
					className={`text-center ${performance.color} font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
					tabIndex={0}
				>
					{score >= 90 &&
						'Outstanding! Your grammar skills are excellent. Keep it up!'}
					{score >= 75 &&
						score < 90 &&
						"👏 Great job! You show strong understanding. A little more practice and you'll be perfect!"}
					{score >= 60 &&
						score < 75 &&
						"💪 You're progressing. Focus on sentence structure and word order."}
					{score < 60 && 'Keep practicing! Grammar takes time. Review the feedback.'}
				</div>
			</div>

			{/* Final Buttons - Navigable */}
			<div className='mt-10 sm:mt-12 flex flex-col sm:flex-row gap-4 justify-center'>
				<button
					onClick={onPlayAgain}
					tabIndex={0}
					aria-label='Play Again - Restart the grammar challenge'
					className='bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors'
				>
					Play Again
				</button>
				<Link
					to='/games'
					tabIndex={0}
					aria-label='Explore other games - Go to the main games menu'
					className='bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors'
				>
					Explore Other Games
				</Link>
			</div>
		</div>
	);
};
