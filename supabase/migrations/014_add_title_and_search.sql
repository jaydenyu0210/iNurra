-- Add title column to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Drop potential conflicting signatures to fix overloading ambiguity
DROP FUNCTION IF EXISTS match_documents(vector, float, int);
DROP FUNCTION IF EXISTS match_documents(vector, float, int, uuid);

-- Create a function to search for documents by embedding similarity
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.raw_text as content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
