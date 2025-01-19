function ErrorWindow({ message, onClose }) {
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-transparent p-6 rounded-lg shadow-lg w-[640px] max-h-[80vh] flex flex-col justify-between items-center overflow-hidden">
        <h2 className="text-xl  font-bold mb-4 bg-[#D6517D] rounded-md shadow-md px-8 py-3 ">
          发生错误
        </h2>
        <div className="flex-grow overflow-y-auto">
          <p
            className="text-lg text-center text-white break-words"
            style={{
              fontSize: "1.2rem",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}
          >
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 bg-pink-600 font-bold text-white py-2 px-4 rounded"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

export default ErrorWindow;
