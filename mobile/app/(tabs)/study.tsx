import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy path — /(tabs)/study is the Hub tab now.
 *
 * Conversations, documents, quizzes and flashcards push here with a threadId,
 * newChat, docId or docName param, so the redirect has to carry them across.
 */
export default function StudyAlias() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(tabs)/hub', params } as any} />;
}
