export function generateSQLPrompt(naturalLanguageQuery: string): string {
    return `You are a DB2 SQL expert. Convert the following natural language query to valid DB2 SQL.

Natural Language Query: "${naturalLanguageQuery}"

Important guidelines:
1. Return ONLY the SQL query without any explanations
2. Use proper DB2 syntax
3. Include the schema if mentioned (default to DICT if not specified)
4. If counting rows, use COUNT(*) 
5. If the query seems to ask for data from a table, use SELECT * but limit to 10 rows unless specified otherwise

SQL Query:`;
}
