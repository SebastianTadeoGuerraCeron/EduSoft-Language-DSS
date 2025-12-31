import { useEffect, useState } from "react";
import { API_URL } from "../API";
import { getUserAttempts } from "../services/examService";

export const Progress = () => {
  const [progress, setProgress] = useState({ history: [] });
  const [examStats, setExamStats] = useState({ attempts: [], stats: {} });
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user || !user.id) return;

    // Cargar historial de juegos
    fetch(`${API_URL}/user/progress?userId=${user.id}`)
      .then((res) => res.json())
      .then((data) => setProgress({ history: data.history || [] }));

    // Cargar historial de exámenes
    fetchExamStats(user.id);
  }, []);

  const fetchExamStats = async (userId) => {
    try {
      setLoadingExams(true);
      const data = await getUserAttempts(userId);
      setExamStats(data);
    } catch (error) {
      console.error("Error fetching exam stats:", error);
    } finally {
      setLoadingExams(false);
    }
  };

  const GAME_TYPES = [
    "Vocabulary Challenge",
    "Reading Challenge",
    "Grammar Challenge",
    "Listening Challenge",
    "Speaking Challenge",
  ];

  const playedTypes = new Set(
    progress.history
      .filter((row) => GAME_TYPES.includes(row.game))
      .map((row) => row.game)
  );
  const percent = Math.min(playedTypes.size * 20, 100);

  const getAverage = (type) => {
    const games = progress.history.filter((row) => row.game === type);
    if (!games.length) return null;
    const avg = Math.round(
      games.reduce((acc, row) => acc + (row.score || 0), 0) / games.length
    );
    return avg;
  };

  const minAvgType = (() => {
    let minType = null;
    let minAvg = Infinity;
    GAME_TYPES.forEach((type) => {
      const avg = getAverage(type);
      if (avg !== null && avg < minAvg) {
        minAvg = avg;
        minType = type;
      }
    });
    return minType;
  })();

  const getPracticeStreak = () => {
    const dates = Array.from(
      new Set(
        progress.history.map((row) => new Date(row.playedAt).toDateString())
      )
    ).sort((a, b) => new Date(b) - new Date(a));
    if (dates.length === 0) return 0;
    let streak = 1;
    let prev = new Date(dates[0]);
    for (let i = 1; i < dates.length; i++) {
      const curr = new Date(dates[i]);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        prev = curr;
      } else if (diff > 1) {
        break;
      }
    }
    return streak;
  };
  const streak = getPracticeStreak();

  return (
    <main className="w-full min-h-screen bg-[#fff] flex flex-col items-center text-left text-sm text-[#000] font-lexend">
      <section className="w-full max-w-[1280px] bg-[#f7fafc] flex-1 flex flex-col items-center justify-center min-h-[600px] md:min-h-[700px] lg:min-h-[800px]">
        <section className="w-full flex flex-col items-center justify-center">
          <header className="w-full flex flex-col items-center justify-start py-5 px-4 md:px-16 lg:px-40 box-border">
            <div className="w-full max-w-[960px] flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h1
                  className="text-2xl md:text-4xl font-bold leading-10 mb-2"
                  tabIndex={0}
                >
                  Your Progress
                </h1>
                <p className="text-sm md:text-base text-[#4C7490]" tabIndex={0}>
                  Track your learning journey in EduSoft Language! Here you can
                  view your overall progress, see your average scores for each
                  game type, check your daily practice streak, and get friendly
                  tips to helper you improve even more.
                </p>
              </div>
              <section className="w-full flex flex-col items-start justify-start p-4 gap-3">
                <div className="w-full flex flex-row items-center justify-between gap-2">
                  <h2 className="leading-6 font-medium" tabIndex={0}>
                    Complete all game types to reach 100% progress
                  </h2>
                  <span className="h-6 text-sm" tabIndex={0}>
                    {percent}%
                  </span>
                </div>
                <progress
                  value={percent}
                  max="100"
                  className="w-full rounded h-2"
                  aria-label={`Overall progress: ${percent}% complete`}
                ></progress>
              </section>
              <section className="w-full flex flex-col items-start justify-start pt-5 px-4 pb-3">
                <h2
                  className="leading-7 font-bold text-lg md:text-[22px]"
                  tabIndex={0}
                >
                  Average Scores by Game Type
                </h2>
              </section>
              <section className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 px-4">
                {GAME_TYPES.map((type) => {
                  const avg = getAverage(type);
                  return (
                    <article
                      key={type}
                      className="bg-[#f7fafc] flex flex-col items-center gap-2 min-h-[72px] rounded-lg shadow p-3"
                    >
                      <h3
                        className="font-medium leading-6 text-base text-[#0d171c]"
                        tabIndex={0}
                      >
                        {type.replace(" Challenge", "")}
                      </h3>
                      <p
                        className="text-2xl font-bold text-blue-700"
                        tabIndex={0}
                      >
                        {avg !== null ? (
                          `${avg}/100`
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </p>
                      <p className="text-xs text-[#4C7490]" tabIndex={0}>
                        Average Score
                      </p>
                    </article>
                  );
                })}
              </section>
              <section className="w-full flex flex-col items-start justify-start pt-5 px-4 pb-3">
                <h2
                  className="leading-7 font-bold text-lg md:text-[22px]"
                  tabIndex={0}
                >
                  Practice Summary
                </h2>
              </section>
              <section className="w-full flex flex-row items-center justify-start gap-4 px-4 py-2">
                <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center min-w-[120px]">
                  <span
                    className="text-3xl font-bold text-emerald-600"
                    tabIndex={0}
                  >
                    {streak}
                  </span>
                  <span className="text-xs text-[#4C7490]" tabIndex={0}>
                    Day Streak
                  </span>
                </div>
                {minAvgType && (
                  <div
                    className="bg-blue-100 text-blue-800 rounded p-3 text-sm font-medium flex-1"
                    tabIndex={0}
                    role="status"
                  >
                    <span className="font-bold">
                      {minAvgType.replace(" Challenge", "")}
                    </span>{" "}
                    could use a little extra practice! Give it another try to
                    boost your overall progress. 🚀
                  </div>
                )}
              </section>

              {/* Sección de Exámenes */}
              <section className="w-full flex flex-col items-start justify-start pt-5 px-4 pb-3">
                <h2
                  className="leading-7 font-bold text-lg md:text-[22px]"
                  tabIndex={0}
                >
                  📝 Exam Results
                </h2>
              </section>
              <section className="w-full px-4 py-2">
                {loadingExams ? (
                  <div className="text-center py-4 text-[#4C7490]">
                    Loading exams...
                  </div>
                ) : examStats.attempts?.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-[#4C7490]">
                      You haven't taken any exams yet.
                    </p>
                    <a
                      href="#/exams"
                      className="text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Take your first exam →
                    </a>
                  </div>
                ) : (
                  <>
                    {/* Estadísticas de exámenes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
                        <span
                          className="text-2xl font-bold text-blue-700"
                          tabIndex={0}
                        >
                          {examStats.stats?.totalAttempts || 0}
                        </span>
                        <span className="text-xs text-[#4C7490]" tabIndex={0}>
                          Exams Taken
                        </span>
                      </div>
                      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
                        <span
                          className="text-2xl font-bold text-emerald-600"
                          tabIndex={0}
                        >
                          {examStats.stats?.passedCount || 0}
                        </span>
                        <span className="text-xs text-[#4C7490]" tabIndex={0}>
                          Exams Passed
                        </span>
                      </div>
                      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
                        <span
                          className="text-2xl font-bold text-purple-600"
                          tabIndex={0}
                        >
                          {examStats.stats?.averageScore || 0}%
                        </span>
                        <span className="text-xs text-[#4C7490]" tabIndex={0}>
                          Average Score
                        </span>
                      </div>
                    </div>

                    {/* List of recent attempts */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">
                              Exam
                            </th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">
                              Score
                            </th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {examStats.attempts?.slice(0, 5).map((attempt) => {
                            const passed =
                              (attempt.score || 0) >=
                              (attempt.exam?.passingPercentage || 60);
                            return (
                              <tr key={attempt.id} className="border-t">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-gray-800">
                                    {attempt.exam?.title}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {attempt.exam?.lesson?.title}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`font-bold ${
                                      passed
                                        ? "text-emerald-600"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {Math.round(attempt.score || 0)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                      passed
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {passed ? "✓ Passed" : "✗ Failed"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-gray-500">
                                  {new Date(
                                    attempt.finishedAt
                                  ).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>
          </header>
        </section>
      </section>
    </main>
  );
};
