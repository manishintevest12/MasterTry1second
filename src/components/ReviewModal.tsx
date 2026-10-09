import React, { useState } from 'react';
import { Star, X, MessageSquare, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ReviewModal: React.FC = () => {
  const { reviewModalItem, closeReviewModal, submitReview } = useApp();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [author, setAuthor] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [pros, setPros] = useState<string>('');
  const [cons, setCons] = useState<string>('');

  if (!reviewModalItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !comment.trim()) return;

    submitReview(reviewModalItem.id, {
      author: author.trim() || 'Verified Shopper',
      rating,
      title: title.trim(),
      comment: comment.trim(),
      pros: pros.trim() || undefined,
      cons: cons.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={closeReviewModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-4 h-4 text-orange-600" />
          <h3 className="text-base font-bold text-slate-900">
            Write a Verified Community Review
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Reviewing: <strong className="text-slate-800">{reviewModalItem.title}</strong> · Earn <strong className="text-orange-600">+2 Bonus OmniPoints</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Rating Stars Selector */}
          <div>
            <label className="font-bold text-slate-800 block mb-1.5">
              Overall Experience Rating:
            </label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 cursor-pointer focus:outline-hidden"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-500 fill-amber-400'
                        : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 font-bold text-slate-700 font-mono text-sm">
                {rating}.0 / 5
              </span>
            </div>
          </div>

          {/* Author Name */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Your Name / Handle:
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          {/* Review Headline */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Review Headline: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Great on-time departure and comfortable seating"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          {/* Detailed Comment */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Detailed Experience: <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share details on speed, pricing accuracy, packaging, customer service..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Pros & Cons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-emerald-700 block mb-1">
                Pros (Highlights):
              </label>
              <input
                type="text"
                value={pros}
                onChange={(e) => setPros(e.target.value)}
                placeholder="e.g. Punctual, cheap fare"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="font-semibold text-rose-700 block mb-1">
                Cons (Drawbacks):
              </label>
              <input
                type="text"
                value={cons}
                onChange={(e) => setCons(e.target.value)}
                placeholder="e.g. Paid snacks"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:border-orange-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeReviewModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Submit & Earn +2 Pts</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
