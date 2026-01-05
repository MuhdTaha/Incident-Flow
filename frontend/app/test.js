import { useState, useEffect } from 'react';

// --- 1. THE MOCK API & DATA ---
const SERVER_DATA = [
  { category: "Fruits", price: "$1", stocked: true, name: "Apple" },
  { category: "Fruits", price: "$1", stocked: true, name: "Dragonfruit" },
  { category: "Fruits", price: "$2", stocked: false, name: "Passionfruit" },
  { category: "Vegetables", price: "$2", stocked: true, name: "Spinach" },
  { category: "Vegetables", price: "$4", stocked: false, name: "Pumpkin" },
  { category: "Vegetables", price: "$1", stocked: true, name: "Peas" }
];

function fetchProducts() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate 20% chance of server failure
      const shouldFail = Math.random() < 0.2;
      if (shouldFail) {
        reject(new Error("500: Server is unreachable."));
      } else {
        resolve(SERVER_DATA);
      }
    }, 1500); // 1.5 second delay
  });
}

// --- 2. PRESENTATIONAL COMPONENTS ---

function ProductCategoryRow({ category }) {
  return (
    <tr>
      <th colSpan="2" style={{ textAlign: 'left', paddingTop: '10px' }}>
        {category}
      </th>
    </tr>
  );
}

function ProductRow({ product }) {
  const name = product.stocked ? product.name :
    <span style={{ color: 'red' }}>{product.name}</span>;

  return (
    <tr>
      <td>{name}</td>
      <td>{product.price}</td>
    </tr>
  );
}

function ProductTable({ products, filterText, inStockOnly }) {
  const rows = [];
  let lastCategory = null;

  products.forEach((product) => {
    // Filter Logic
    if (product.name.toLowerCase().indexOf(filterText.toLowerCase()) === -1) {
      return;
    }
    if (inStockOnly && !product.stocked) {
      return;
    }

    // Category Header Logic
    if (product.category !== lastCategory) {
      rows.push(
        <ProductCategoryRow
          category={product.category}
          key={product.category} />
      );
    }
    
    // Product Row Logic
    rows.push(
      <ProductRow
        product={product}
        key={product.name} />
    );
    lastCategory = product.category;
  });

  return (
    <table style={{ marginTop: '20px', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Name</th>
          <th style={{ textAlign: 'left' }}>Price</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>
  );
}

function SearchBar({ filterText, inStockOnly, onFilterTextChange, onInStockChange }) {
  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
      <input
        type="text"
        value={filterText}
        placeholder="Search..."
        onChange={(e) => onFilterTextChange(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => onInStockChange(e.target.checked)}
        />
        {' '}
        Only show products in stock
      </label>
      
      {/* The Reset Button we added */}
      <button 
        type="button" 
        onClick={() => {
          onFilterTextChange('');
          onInStockChange(false);
        }}
      >
        Reset Filters
      </button>
    </form>
  );
}

function FilterableProductTable({ products }) {
  // Shared State
  const [filterText, setFilterText] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  return (
    <div style={{ fontFamily: 'sans-serif', width: '300px', margin: '20px auto' }}>
      <SearchBar
        filterText={filterText}
        inStockOnly={inStockOnly}
        onFilterTextChange={setFilterText}
        onInStockChange={setInStockOnly}
      />
      <ProductTable
        products={products}
        filterText={filterText}
        inStockOnly={inStockOnly}
      />
    </div>
  );
}

// --- 3. ROOT COMPONENT (App) ---

export default function App() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setError(null);
      setIsLoading(true);
      try {
        const data = await fetchProducts();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (error) {
    return (
      <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>
        <h3>Error: {error}</h3>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  if (isLoading) {
    return <h2 style={{ textAlign: 'center', marginTop: '50px' }}>Loading inventory...</h2>;
  }

  return <FilterableProductTable products={products} />;
}