import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getPlans, isPremiumUser } from '../../services/billingService';
import '../../styles/Billing.css';

/**
 * Pricing Page - Plan Comparison
 * Shows available plans and allows upgrading to premium
 */
const Pricing = () => {
    const { user, isAuthenticated, hasRole } = useAuth();
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Verify that it's a student
        if (isAuthenticated && !hasRole(['STUDENT_FREE', 'STUDENT_PRO'])) {
            navigate('/home');
            return;
        }
        loadPlans();
    }, [isAuthenticated, user]);

    const loadPlans = async () => {
        try {
            setLoading(true);
            const data = await getPlans();
            setPlans(data.plans || []);
        } catch (err) {
            console.error('Error loading plans:', err);
            setError('Failed to load plans. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlan = (planId) => {
        // If not authenticated, redirect to login
        if (!isAuthenticated) {
            navigate('/login', { state: { from: '/billing/upgrade', selectedPlan: planId } });
            return;
        }

        // If already premium, redirect to subscription management
        if (isPremiumUser(user)) {
            navigate('/billing/subscription');
            return;
        }

        // Redirect to Upgrade page with the selected plan
        // There the user will enter their card in our form
        navigate(`/billing/upgrade?plan=${planId}`);
    };

    const userIsPremium = user && isPremiumUser(user);

    if (loading) {
        return (
            <div className="pricing-container">
                <div className="pricing-header">
                    <h1>Loading plans...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="pricing-container">
            <div className="pricing-header">
                <h1>Upgrade to Premium</h1>
                <p>Unlock all lessons, exams, and exclusive content</p>
            </div>

            {error && (
                <div className="error-message" style={{ textAlign: 'center', color: '#dc2626', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {userIsPremium && (
                <div className="promo-banner" style={{ background: '#16a34a', marginBottom: '2rem' }}>
                    <div className="promo-banner-text">
                        <h3>You're already a Pro member!</h3>
                        <p>Enjoy all premium features</p>
                    </div>
                    <Link to="/billing/subscription" className="promo-banner-button">
                        Manage Subscription
                    </Link>
                </div>
            )}

            <div className="pricing-cards">
                {/* Free Plan */}
                <div className="pricing-card">
                    <h2 className="plan-name">Free</h2>
                    <div className="plan-price">
                        <span className="currency">$</span>
                        <span className="amount">0</span>
                        <span className="interval">/forever</span>
                    </div>
                    <ul className="plan-features">
                        <li>Access to free lessons</li>
                        <li>Access to free exams</li>
                        <li>Community support</li>
                    </ul>
                    <button
                        className="plan-button secondary"
                        disabled
                    >
                        Current Plan
                    </button>
                </div>

                {/* Dynamic Plans from API */}
                {plans.map((plan, index) => (
                    <div
                        key={plan.id}
                        className={`pricing-card ${index === 0 ? 'featured' : ''}`}
                    >
                        <h2 className="plan-name">{plan.name}</h2>
                        <div className="plan-price">
                            <span className="currency">$</span>
                            <span className="amount">{plan.price}</span>
                            <span className="interval">/{plan.interval}</span>
                        </div>
                        {plan.savings && (
                            <span className="plan-savings">{plan.savings}</span>
                        )}
                        <ul className="plan-features">
                            {plan.features?.map((feature, i) => (
                                <li key={i}>{feature}</li>
                            ))}
                        </ul>
                        <button
                            className={`plan-button ${index === 0 ? 'primary' : 'secondary'}`}
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={userIsPremium}
                        >
                            {userIsPremium ? 'Already Pro' : 'Get Started'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Comparison Table */}
            <div style={{ marginTop: '4rem', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '2rem' }}>Compare Plans</h2>
                <table className="payment-table" style={{ maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '12px', overflow: 'hidden' }}>
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Free</th>
                            <th>Pro</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Basic Lessons</td>
                            <td className="text-green-600">Yes</td>
                            <td className="text-green-600">Yes</td>
                        </tr>
                        <tr>
                            <td>Premium Lessons</td>
                            <td></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Exam Attempts</td>
                            <td>Limited</td>
                            <td>Unlimited</td>
                        </tr>
                        <tr>
                            <td>All Games</td>
                            <td>Basic</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td>Priority Support</td>
                            <td></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* FAQ Section */}
            <div style={{ marginTop: '4rem', maxWidth: '600px', margin: '4rem auto 0' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Frequently Asked Questions</h2>

                <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Can I cancel anytime?</h4>
                    <p style={{ color: '#666', margin: 0 }}>
                        Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
                    </p>
                </div>

                <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>What payment methods do you accept?</h4>
                    <p style={{ color: '#666', margin: 0 }}>
                        We accept all major credit and debit cards including Visa, Mastercard, and American Express.
                    </p>
                </div>

                <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Is my payment information secure?</h4>
                    <p style={{ color: '#666', margin: 0 }}>
                        Absolutely! All payment data is encrypted using AES-256 encryption and processed securely through Stripe.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Pricing;
