-- Fix match_documents function to include user_id filtering
-- This restores the proper signature that includes user_id_filter parameter

-- Drop the old function signatures
DROP FUNCTION IF EXISTS match_documents(vector, float, int);
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);
DROP FUNCTION IF EXISTS match_documents(vector(768), float, int);
DROP FUNCTION IF EXISTS match_documents(vector(768), float, int, uuid);

-- Create the correct function with user_id filtering
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  type document_type,
  summary text,
  raw_text text,
  extracted_data jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.type,
    d.summary,
    d.raw_text,
    d.extracted_data,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE 
    d.embedding IS NOT NULL
    AND (user_id_filter IS NULL OR d.user_id = user_id_filter)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
