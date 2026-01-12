import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { API_URL } from '../../../API';
import { HeaderGame } from '../../../components/HeaderGame';
import { useAuth } from '../../../context/AuthContext';
import { SENTENCES_STACK_FOR_READING } from '../CONST_VALUES';
import { getRandomElements, shuffleArray } from '../../../utils/gameRandomization';

// Selecciona 5 lecturas aleatorias usando utility function documentada
const passages = getRandomElements(SENTENCES_STACK_FOR_READING, 5);
console.log(passages); // TODO: eliminar en producción

export const Reading = () => {
	const total = passages.length;
	const [idx, setIdx] = useState(0);
	const [blanks, setBlanks] = useState([]);
	const [verified, setVerified] = useState(false);
	const [alert, setAlert] = useState('');
	const [results, setResults] = useState([]);
	const [score, setScore] = useState(0);
	const [finished, setFinished] = useState(false);
	const { user } = useAuth();

	const current = passages[idx];
	// Mezclar respuestas con utility function para aleatorización no-crítica
	const choices = shuffleArray([...current.answers, ...current.distractors]);

	// al cambiar de lectura, reinicia
	useEffect(() => {
		setBlanks(Array(current.answers.length).fill(''));
		setVerified(false);
		setAlert('');
	}, [idx, current.answers.length]);

	// helpers
	const allFilled = blanks.every((w) => w !== '');
	const allCorrect = blanks.every((w, i) => w === current.answers[i]);

	const selectWord = (i, val) =>
		setBlanks((b) => {
			const copy = [...b];
			copy[i] = val;
			return copy;
		});

	// Función para manejar navegación por teclado en select
	const handleSelectKeyDown = (e, index) => {
		if (verified) return; // No permitir cambios si ya está verificado

		const select = e.target;
		const options = Array.from(select.options);
		const currentIndex = options.findIndex((option) => option.value === blanks[index]);

		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowRight': {
				e.preventDefault();
				const nextIndex = Math.min(currentIndex + 1, options.length - 1);
				if (nextIndex !== currentIndex) {
					selectWord(index, options[nextIndex].value);
				}
				break;
			}

			case 'ArrowUp':
			case 'ArrowLeft': {
				e.preventDefault();
				const prevIndex = Math.max(currentIndex - 1, 0);
				if (prevIndex !== currentIndex) {
					selectWord(index, options[prevIndex].value);
				}
				break;
			}

			case 'Home': {
				e.preventDefault();
				selectWord(index, options[1].value); // Skip empty option
				break;
			}

			case 'End': {
				e.preventDefault();
				selectWord(index, options[options.length - 1].value);
				break;
			}

			case 'Delete':
			case 'Backspace': {
				e.preventDefault();
				selectWord(index, '');
				break;
			}
		}
	};

	const handleVerify = () => {
		if (!allFilled) {
			setAlert('Please complete all spaces before checking.');
			return;
		}
		setVerified(true);

		/* se crea un resultado POR LECTURA */
		const readingResult = {
			idx: idx,
			text: current.text,
			userAnswers: [...blanks],
			correctAnswers: [...current.answers],
			isCorrect: allCorrect, // sigue siendo incorrecta si hay alguna errónea
		};
		setResults((prev) => [...prev, readingResult]);

		// Calcular el score usando una variable temporal para incluir crédito parcial
		const tempResults = [...results, readingResult];
		const totalTempScore = tempResults.reduce((acc, r) => {
			const maxPoints = 100 / passages.length;
			// Calcula cuántas respuestas fueron correctas
			const numCorrect = r.userAnswers.reduce(
				(count, ans, i) => (ans === r.correctAnswers[i] ? count + 1 : count),
				0
			);
			// Si se escogió al menos una correcta, se asigna crédito parcial,
			// pero la lectura se marca como incorrecta si alguna falla.
			const points =
				numCorrect > 0 ? (numCorrect / r.correctAnswers.length) * maxPoints : 0;
			return acc + points;
		}, 0);

		setScore(Math.round(totalTempScore));
	};

	const handleNext = () => {
		setIdx((i) => i + 1);
	};

	/* ---------- Finish ---------- */
	const handleFinish = async () => {
		// score ya está calculado en state «score»
		setFinished(true);
		if (user?.id) {
			const token = localStorage.getItem('token');
			await fetch(`${API_URL}/user/game-history`, {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
				},
				body: JSON.stringify({
					userId: user.id,
					game: 'Reading Challenge',
					score,
				}),
			});
		}
	};

	// UI final
	if (finished)
		return (
			<GameResumeDetails
				results={results} // [{index, text, userAnswers, correctAnswers, isCorrect}, …]
				score={score} // 0-100
				onPlayAgain={() => window.location.reload()}
			/>
		);

	// UI principal
	return (
		<section className='max-w-2xl mx-auto p-6 space-y-6'>
			<HeaderGame
				typeGame='Reading'
				title='Choose the correct word'
				currentStep={idx + 1}
				totalSteps={total}
				score={score}
			/>

			<div className='leading-relaxed text-md'>
				{current.text.split(/(\{\d\})/g).map((seg, k) => {
					const m = seg.match(/\{(\d)\}/);
					if (!m)
						return (
							<span key={k} tabIndex={0}>
								{seg}
							</span>
						);

					const i = Number(m[1]);
					const filled = blanks[i];
					const correct = current.answers[i];
					const wrong = verified && filled !== correct;

					return (
						<span key={k} className='inline-flex items-center'>
							<select
								value={filled}
								disabled={verified}
								onChange={(e) => selectWord(i, e.target.value)}
								onKeyDown={(e) => handleSelectKeyDown(e, i)}
								className={`mx-1 border rounded px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${verified && filled === correct
										? 'bg-green-100'
										: wrong
											? 'bg-red-100'
											: ''
									}`}
								aria-label={`Blank ${i + 1} of ${current.answers.length}`}
								aria-describedby={wrong ? `correction-${i}` : undefined}
							>
								<option value=''>___</option>
								{choices.map((c) => (
									<option key={c} value={c}>
										{c}
									</option>
								))}
							</select>

							{/* Correction visible when checking if answer was wrong */}
							{wrong && (
								<span
									id={`correction-${i}`}
									className='text-emerald-700 text-sm italic ml-1'
									tabIndex={0}
									role='status'
									aria-label={`Correct answer: ${correct}`}
								>
									{correct}
								</span>
							)}
						</span>
					);
				})}
			</div>

			{/* Aviso faltan espacios */}
			{alert && !verified && (
				<p className='text-red-600 text-sm' tabIndex={0} role='alert'>
					{alert}
				</p>
			)}

			{/* Botonera */}
			<div className='flex flex-col justify-center sm:flex-row gap-3 sm:gap-4'>
				{!verified && (
					<button
						onClick={handleVerify}
						className='bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-40 cursor-pointer'
					>
						Verify
					</button>
				)}

				{verified && idx < total - 1 && (
					<button
						onClick={handleNext}
						className='bg-green-500 text-white px-4 py-2 rounded shadow hover:bg-green-600 transition-colors duration-150 cursor-pointer'
					>
						Next ➔
					</button>
				)}

				{verified && idx === total - 1 && (
					<button
						onClick={handleFinish}
						className='bg-neutral-700 text-white px-4 py-2 rounded cursor-pointer'
					>
						Finish
					</button>
				)}
			</div>
		</section>
	);
};

const GameResumeDetails = ({ results, score, onPlayAgain }) => {
	const correctReadings = results.filter((r) => r.isCorrect);
	const incorrectReadings = results.filter((r) => !r.isCorrect);
	const accuracy =
		results.length > 0 ? Math.round((correctReadings.length / results.length) * 100) : 0;

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
					{score}
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
						{correctReadings.length}/{results.length}
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>
						Perfect Readings
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
						{results.length}
					</div>
					<div className='text-sm text-gray-600' tabIndex={0}>
						Total Passages
					</div>
				</div>
			</div>

			<p className='text-gray-600 text-center mb-8 sm:mb-10' tabIndex={0}>
				Let's review your reading comprehension performance. Use this feedback to improve
				your understanding of context and vocabulary.
			</p>

			<div className='space-y-8'>
				{/* Sección de respuestas correctas */}
				{correctReadings.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-green-700 mb-4 flex items-center'
							tabIndex={0}
						>
							<span className='bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✓
							</span>
							Perfect Readings ({correctReadings.length})
						</h2>
						<div className='space-y-3'>
							{correctReadings.map((r, i) => (
								<div
									key={i}
									className='p-4 bg-green-50 border border-green-200 rounded-lg'
								>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-green-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}
										>
											{r.idx + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-2' tabIndex={0}>
												Reading {r.idx + 1}
											</p>
											<p className='text-sm text-gray-700 mb-2' tabIndex={0}>
												{r.text.replace(/\{\d\}/g, '_____')}
											</p>
											<p className='text-sm text-gray-600' tabIndex={0}>
												Your answers:{' '}
												<span className='font-medium text-green-700'>
													{r.userAnswers.join(', ')}
												</span>
											</p>
											<p className='text-sm text-gray-600' tabIndex={0}>
												Correct answers:{' '}
												<span className='font-medium text-green-700'>
													{r.correctAnswers.join(', ')}
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
				{incorrectReadings.length > 0 && (
					<section>
						<h2
							className='text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center'
							tabIndex={0}
						>
							<span className='bg-gray-200 text-gray-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-lg'>
								✗
							</span>
							Areas for Improvement ({incorrectReadings.length})
						</h2>
						<div className='space-y-3'>
							{incorrectReadings.map((r, i) => (
								<div key={i} className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
									<div className='flex items-start gap-3'>
										<div
											className='flex-shrink-0 bg-gray-500 text-white rounded-full h-6 w-6 flex items-center justify-center font-bold text-sm'
											tabIndex={0}
										>
											{r.idx + 1}
										</div>
										<div>
											<p className='font-semibold text-gray-900 mb-2' tabIndex={0}>
												Reading {r.idx + 1}
											</p>
											<p className='text-sm text-gray-700 mb-2' tabIndex={0}>
												{r.text.replace(/\{\d\}/g, '_____')}
											</p>
											<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
												Correct answers:{' '}
												<span className='font-medium text-blue-700'>
													{r.correctAnswers.join(', ')}
												</span>
											</p>
											<p className='text-sm text-gray-600 mb-2' tabIndex={0}>
												Your answers:{' '}
												<span className='font-medium text-blue-700'>
													{r.userAnswers.join(', ')}
												</span>
											</p>
											<div className='flex gap-4 text-xs text-gray-500 mb-2' tabIndex={0}>
												<span>
													Words filled: {r.userAnswers.filter((a) => a !== '').length}/
													{r.correctAnswers.length}
												</span>
											</div>
											<p
												className='text-xs text-blue-700 bg-blue-50 p-2 rounded border-l-2 border-blue-300'
												tabIndex={0}
											>
												Tip: Read the entire passage carefully and consider the
												context. Look for clues that help determine the right word choice.
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
					{score >= 90 &&
						'Outstanding! Your reading comprehension is excellent. Keep up the great work!'}
					{score >= 75 &&
						score < 90 &&
						"👏 Good job! You're showing strong reading skills. A little more practice and you'll be perfect!"}
					{score >= 60 &&
						score < 75 &&
						"💪 You're making progress! Focus on understanding context and vocabulary relationships to improve your results."}
					{score < 60 &&
						'Keep practicing! Reading comprehension takes time to develop. Review the feedback and try again.'}
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
