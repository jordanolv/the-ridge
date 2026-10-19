import QuizConfigModel, { IQuizConfigDoc } from '../models/quiz-config.model';
import { QuizQuestion } from '../services/quiz.service';

const RECENT_QUESTIONS_KEPT = 1000;

export class QuizConfigRepository {
  static async getOrCreate(): Promise<IQuizConfigDoc> {
    const existing = await QuizConfigModel.findOne();
    if (existing) return existing;
    return QuizConfigModel.create({ activeAnswers: {} });
  }

  static async setActiveQuestions(messageId: string, questions: QuizQuestion[], activeUntil: Date): Promise<void> {
    const doc = await this.getOrCreate();
    doc.activeMessageId = messageId;
    doc.activeQuestions = questions;
    doc.activeUntil = activeUntil;
    doc.activeThemeChoices = {};
    doc.activeAnswers = {};
    doc.firstCorrectByQuestion = {};
    const prev = doc.recentQuestionTexts ?? [];
    doc.recentQuestionTexts = [...prev, ...questions.map((q) => q.id)].slice(-RECENT_QUESTIONS_KEPT);
    doc.markModified('activeQuestions');
    doc.markModified('activeThemeChoices');
    doc.markModified('activeAnswers');
    doc.markModified('firstCorrectByQuestion');
    doc.markModified('recentQuestionTexts');
    await doc.save();
  }

  static async setAnnounceMessage(messageId: string | null): Promise<void> {
    await QuizConfigModel.updateOne(
      {},
      messageId ? { $set: { announceMessageId: messageId } } : { $unset: { announceMessageId: '' } },
    );
  }

  static async saveThemeChoice(userId: string, questionId: string): Promise<void> {
    await QuizConfigModel.updateOne({}, { $set: { [`activeThemeChoices.${userId}`]: questionId } });
  }

  static async saveAnswer(userId: string, choiceIndex: number, questionId: string, isFirstCorrect: boolean): Promise<void> {
    await QuizConfigModel.updateOne(
      {},
      {
        $set: {
          [`activeAnswers.${userId}`]: choiceIndex,
          ...(isFirstCorrect ? { [`firstCorrectByQuestion.${questionId}`]: userId } : {}),
        },
      },
    );
  }

  static async clearActiveQuestion(): Promise<void> {
    const doc = await this.getOrCreate();
    doc.activeMessageId = undefined;
    doc.activeQuestions = [];
    doc.activeUntil = undefined;
    doc.activeThemeChoices = {};
    doc.activeAnswers = {};
    doc.firstCorrectByQuestion = {};
    doc.markModified('activeQuestions');
    doc.markModified('activeThemeChoices');
    doc.markModified('activeAnswers');
    doc.markModified('firstCorrectByQuestion');
    await doc.save();
  }
}
